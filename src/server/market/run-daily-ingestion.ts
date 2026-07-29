import "server-only";
import { fetchBcbSnapshot } from "@/features/market/bcb";
import { createMarketAdminClient } from "@/server/market/admin-client";

const SOURCE_ID = "bcb-sgs";

function dateInSaoPaulo(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function runDailyMarketIngestion(now = new Date()) {
  const supabase = createMarketAdminClient();
  const recentCutoff = new Date(now.valueOf() - 30 * 60 * 1000).toISOString();
  const { count: recentFailures, error: circuitError } = await supabase
    .from("market_ingestion_runs")
    .select("id", { count: "exact", head: true })
    .eq("source_id", SOURCE_ID)
    .eq("status", "failed")
    .gte("started_at", recentCutoff);

  if (circuitError) throw new Error("market_observability_unavailable");
  if ((recentFailures ?? 0) >= 3) throw new Error("market_circuit_open");

  const jobKey = `daily-${dateInSaoPaulo(now)}`;
  let { data: run, error: claimError } = await supabase
    .from("market_ingestion_runs")
    .insert({ source_id: SOURCE_ID, job_key: jobKey })
    .select("id")
    .single();

  if (claimError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("market_ingestion_runs")
      .select("id,status")
      .eq("source_id", SOURCE_ID)
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
    const indicators = await fetchBcbSnapshot();
    const { error: writeError } = await supabase.from("market_indicators").upsert(
      indicators.map((indicator) => ({
        source_id: SOURCE_ID,
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
    if (writeError) throw new Error("market_write_failed");

    const { error: finishError } = await supabase
      .from("market_ingestion_runs")
      .update({
        status: "succeeded",
        records_received: indicators.length,
        records_written: indicators.length,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    if (finishError) throw new Error("market_run_finish_failed");

    return { status: "succeeded" as const, recordsWritten: indicators.length };
  } catch (error) {
    const allowedCodes = new Set([
      "bcb_invalid_date",
      "bcb_future_date",
      "bcb_payload_too_large",
      "bcb_unavailable",
      "bcb_value_out_of_range",
      "market_run_finish_failed",
      "market_write_failed",
    ]);
    const errorCode = error instanceof Error && allowedCodes.has(error.message)
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
        source_id: SOURCE_ID,
        severity: "critical",
        code: "expected_snapshot_missing",
        summary: "O snapshot diário esperado não foi persistido.",
      }),
    ]);
    throw new Error(errorCode);
  }
}
