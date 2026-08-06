import "server-only";
import { fetchLatestB3EquityPrices, fetchLatestB3Ibovespa } from "@/features/market/b3";
import { fetchBcbSnapshot } from "@/features/market/bcb";
import type { MarketIndicator, MarketPrice } from "@/features/market/types";
import { createMarketAdminClient } from "@/server/market/admin-client";
import { settleSequentially } from "@/server/market/settle-sequentially";

type MarketSnapshot = {
  indicators: MarketIndicator[];
  prices: MarketPrice[];
};

const DEFAULT_B3_INSTRUMENTS = new Map([
  ["PETR4", "Petrobras PN"],
  ["VALE3", "Vale ON"],
  ["ITUB4", "Itaú Unibanco PN"],
  ["B3SA3", "B3 ON"],
  ["WEGE3", "WEG ON"],
  ["MGLU3", "Magazine Luiza ON"],
]);

const SOURCES: Array<{
  id: string;
  fetchSnapshot: (
    now: Date,
    supabase: ReturnType<typeof createMarketAdminClient>,
  ) => Promise<MarketSnapshot>;
}> = [
  {
    id: "bcb-sgs",
    fetchSnapshot: async () => ({ indicators: await fetchBcbSnapshot(), prices: [] }),
  },
  {
    id: "b3-public-eod",
    fetchSnapshot: async (now, supabase) => {
      const { data, error } = await supabase
        .from("portfolio_instruments")
        .select("symbol,name")
        .eq("currency", "BRL")
        .in("asset_class", ["acoes", "fundos", "fiis"])
        .limit(200);
      if (error) throw new Error("market_portfolio_symbols_unavailable");

      const names = new Map(DEFAULT_B3_INSTRUMENTS);
      for (const instrument of data ?? []) {
        const symbol = String(instrument.symbol).trim().toUpperCase();
        if (/^[A-Z0-9]{4,12}$/.test(symbol)) names.set(symbol, String(instrument.name));
      }

      const indicator = await fetchLatestB3Ibovespa(now);
      const prices = (await fetchLatestB3EquityPrices(names.keys(), now)).map((price) => ({
        ...price,
        name: names.get(price.symbol) ?? price.symbol,
      }));
      return { indicators: [indicator], prices };
    },
  },
];

const allowedErrorCodes = new Set([
  "b3_invalid_date",
  "b3_invalid_payload",
  "b3_payload_too_large",
  "b3_unavailable",
  "b3_value_out_of_range",
  "bcb_invalid_date",
  "bcb_future_date",
  "bcb_payload_too_large",
  "bcb_unavailable",
  "bcb_value_out_of_range",
  "market_run_finish_failed",
  "market_portfolio_symbols_unavailable",
  "market_write_failed",
]);

function dateInSaoPaulo(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function runSourceIngestion({
  sourceId,
  fetchSnapshot,
  now,
  supabase,
}: {
  sourceId: string;
  fetchSnapshot: (
    now: Date,
    supabase: ReturnType<typeof createMarketAdminClient>,
  ) => Promise<MarketSnapshot>;
  now: Date;
  supabase: ReturnType<typeof createMarketAdminClient>;
}) {
  const recentCutoff = new Date(now.valueOf() - 30 * 60 * 1000).toISOString();
  const { count: recentFailures, error: circuitError } = await supabase
    .from("market_ingestion_runs")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("status", "failed")
    .gte("started_at", recentCutoff);

  if (circuitError) throw new Error("market_observability_unavailable");
  if ((recentFailures ?? 0) >= 3) throw new Error("market_circuit_open");

  const jobKey = `daily-${dateInSaoPaulo(now)}`;
  let { data: run, error: claimError } = await supabase
    .from("market_ingestion_runs")
    .insert({ source_id: sourceId, job_key: jobKey })
    .select("id")
    .single();

  if (claimError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("market_ingestion_runs")
      .select("id,status")
      .eq("source_id", sourceId)
      .eq("job_key", jobKey)
      .single();
    if (existingError || !existing) throw new Error("market_run_claim_failed");
    if (existing.status !== "failed") return { status: "already_processed" as const };

    const { data: retried, error: retryError } = await supabase
      .from("market_ingestion_runs")
      .update({
        status: "running",
        error_code: null,
        records_received: 0,
        records_written: 0,
        started_at: now.toISOString(),
        finished_at: null,
      })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .single();
    if (retryError || !retried) return { status: "already_processed" as const };
    run = retried;
    claimError = null;
  }
  if (claimError || !run) throw new Error("market_run_claim_failed");

  try {
    const snapshot = await fetchSnapshot(now, supabase);
    const { error: indicatorWriteError } = snapshot.indicators.length === 0
      ? { error: null }
      : await supabase.from("market_indicators").upsert(
        snapshot.indicators.map((indicator) => ({
        source_id: sourceId,
        code: indicator.code,
        source_series: indicator.sourceSeries,
        label: indicator.label,
        value: indicator.value,
        unit: indicator.unit,
        observed_on: indicator.observedOn,
        fetched_at: now.toISOString(),
      })),
      { onConflict: "source_id,code,observed_on" },
    );
    if (indicatorWriteError) throw new Error("market_write_failed");

    if (snapshot.prices.length > 0) {
      const { data: instruments, error: instrumentWriteError } = await supabase
        .from("market_instruments")
        .upsert(snapshot.prices.map((price) => ({
          source_id: sourceId,
          source_instrument_id: price.sourceInstrumentId,
          symbol: price.symbol,
          name: price.name,
          asset_class: "b3_listed",
          currency: "BRL",
          market: "B3",
          active: true,
        })), { onConflict: "source_id,source_instrument_id" })
        .select("id,source_instrument_id");
      if (instrumentWriteError || !instruments) throw new Error("market_write_failed");

      const instrumentIds = new Map(instruments.map((instrument) => [
        instrument.source_instrument_id,
        instrument.id,
      ]));
      const rows = snapshot.prices.map((price) => ({
        instrument_id: instrumentIds.get(price.sourceInstrumentId),
        source_id: sourceId,
        observed_at: `${price.observedOn}T23:00:00.000Z`,
        currency: "BRL",
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.close,
        volume: null,
        fetched_at: now.toISOString(),
      }));
      if (rows.some((row) => !row.instrument_id)) throw new Error("market_write_failed");
      const { error: priceWriteError } = await supabase
        .from("market_prices")
        .upsert(rows, { onConflict: "instrument_id,source_id,observed_at" });
      if (priceWriteError) throw new Error("market_write_failed");
    }

    const recordsWritten = snapshot.indicators.length + snapshot.prices.length;

    const { error: finishError } = await supabase
      .from("market_ingestion_runs")
      .update({
        status: "succeeded",
        records_received: recordsWritten,
        records_written: recordsWritten,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    if (finishError) throw new Error("market_run_finish_failed");

    return { status: "succeeded" as const, recordsWritten };
  } catch (error) {
    const errorCode = error instanceof Error && allowedErrorCodes.has(error.message)
      ? error.message
      : "provider_snapshot_failed";
    await Promise.all([
      supabase.from("market_ingestion_runs").update({
        status: "failed",
        error_code: errorCode,
        finished_at: new Date().toISOString(),
      }).eq("id", run.id),
      supabase.from("market_data_alerts").insert({
        run_id: run.id,
        source_id: sourceId,
        severity: "critical",
        code: "expected_snapshot_missing",
        summary: "O snapshot diário esperado não foi persistido.",
      }),
    ]);
    throw new Error(errorCode);
  }
}

export async function runDailyMarketIngestion(now = new Date()) {
  const settled = await settleSequentially(SOURCES, (source) => runSourceIngestion({
    sourceId: source.id,
    fetchSnapshot: source.fetchSnapshot,
    now,
    supabase: createMarketAdminClient(),
  }));
  const failure = settled.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;

  const results = settled.map((result, index) => ({
    source: SOURCES[index]!.id,
    result: (result as PromiseFulfilledResult<Awaited<ReturnType<typeof runSourceIngestion>>>).value,
  }));
  return {
    status: "succeeded" as const,
    recordsWritten: results.reduce(
      (total, item) => total + (item.result.status === "succeeded" ? item.result.recordsWritten : 0),
      0,
    ),
    sources: results,
  };
}
