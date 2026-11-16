import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { derivePosition, type PortfolioTransaction } from "@/features/portfolio/ledger";
import type { InstrumentTerms } from "@/features/portfolio/terms";
import { marketKeyFor, resolveValue, type Mark, type ResolvedValue } from "@/features/portfolio/value";
import { estimateInstrument } from "@/server/estimates/instrument";

/** Campos que as telas precisam para valorizar uma posição. */
export const PORTFOLIO_VALUE_SELECT = `
  id, symbol, name, asset_class, latest_price, price_observed_at,
  portfolio_institutions(name),
  portfolio_instrument_terms(*),
  portfolio_valuations(valued_on, total_value, unit_price, source),
  portfolio_transactions(
    id, transaction_type, quantity, unit_price, fees, cash_amount,
    reverses_transaction_id, corrects_transaction_id, audit_reason,
    trade_date, created_at
  )
`;

export type ValuableInstrument = {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  latest_price: string | number | null;
  price_observed_at: string | null;
  portfolio_institutions?: { name: string } | null;
  portfolio_instrument_terms: InstrumentTerms | InstrumentTerms[] | null;
  portfolio_valuations: Array<{ valued_on: string; total_value: string | number; unit_price: string | number; source: string }> | null;
  portfolio_transactions: PortfolioTransaction[];
};

export type ValuedInstrument<T extends ValuableInstrument = ValuableInstrument> = {
  instrument: T;
  terms: InstrumentTerms | null;
  position: ReturnType<typeof derivePosition>;
  resolved: ResolvedValue;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function loadMarks(supabase: SupabaseClient, keys: Array<ReturnType<typeof marketKeyFor>>) {
  const symbols = [...new Set(keys.flatMap((key) => (key?.kind === "b3" ? [key.symbol] : [])))];
  const treasury = [...new Set(keys.flatMap((key) => (key?.kind === "tesouro" ? [key.sourceInstrumentId] : [])))];
  const marks = new Map<string, Mark>();
  const queries: PromiseLike<unknown>[] = [];
  if (symbols.length > 0) {
    queries.push(supabase.from("market_latest_prices").select("symbol, close, observed_at")
      .eq("source_id", "b3-public-eod").in("symbol", symbols)
      .then(({ data }) => {
        for (const row of (data ?? []) as Array<{ symbol: string; close: string | number; observed_at: string }>) {
          marks.set(`b3:${row.symbol}`, { price: Number(row.close), observedOn: row.observed_at.slice(0, 10), kind: "b3" });
        }
      }));
  }
  if (treasury.length > 0) {
    queries.push(supabase.from("market_latest_prices").select("source_instrument_id, close, observed_at")
      .eq("source_id", "tesouro-transparente").in("source_instrument_id", treasury)
      .then(({ data }) => {
        for (const row of (data ?? []) as Array<{ source_instrument_id: string; close: string | number; observed_at: string }>) {
          marks.set(`tesouro:${row.source_instrument_id}`, { price: Number(row.close), observedOn: row.observed_at.slice(0, 10), kind: "tesouro" });
        }
      }));
  }
  await Promise.all(queries);
  return marks;
}

/** Valoriza cada posição: preço de mercado, valor informado (âncora), estimativa pelo contrato ou último lançamento. */
export async function valuePortfolio<T extends ValuableInstrument>(
  supabase: SupabaseClient,
  instruments: readonly T[],
  today: string,
): Promise<ValuedInstrument<T>[]> {
  const prepared = instruments.flatMap((instrument) => {
    try {
      const position = derivePosition(instrument.portfolio_transactions, instrument.latest_price);
      return [{ instrument, terms: firstOf(instrument.portfolio_instrument_terms), position }];
    } catch {
      return [];
    }
  });
  const keys = prepared.map(({ instrument, terms }) => marketKeyFor(instrument, terms));
  const marks = await loadMarks(supabase, keys);

  return Promise.all(prepared.map(async ({ instrument, terms, position }, index) => {
    const key = keys[index] ?? null;
    const mark = key
      ? marks.get(key.kind === "b3" ? `b3:${key.symbol}` : `tesouro:${key.sourceInstrumentId}`) ?? null
      : null;

    const valuation = instrument.portfolio_valuations?.[0] ?? null;
    // O valor informado só vale como âncora enquanto o preço do ativo continua sendo o dele.
    const informed = valuation && instrument.latest_price !== null
      && Math.abs(Number(valuation.unit_price) - Number(instrument.latest_price)) < 1e-6
      ? { date: valuation.valued_on, totalCents: BigInt(Math.round(Number(valuation.total_value) * 100)) }
      : null;

    const quantity = Number(position.quantity) / 1e8;
    let estimate: { now: number; atInformed: number | null } | null = null;
    if (!mark && terms?.indexer && quantity > 0) {
      const raw = await estimateInstrument({
        transactions: instrument.portfolio_transactions as unknown as Parameters<typeof estimateInstrument>[0]["transactions"],
        terms,
        asOf: today,
        informedOn: informed?.date ?? null,
      }).catch(() => null);
      if (raw) {
        const useNet = raw.net !== null && (!raw.atInformed || raw.atInformed.net !== null);
        estimate = {
          now: useNet ? raw.net! : raw.gross,
          atInformed: raw.atInformed ? (useNet ? raw.atInformed.net! : raw.atInformed.gross) : null,
        };
      }
    }

    const resolved = resolveValue({
      quantity,
      costBasisCents: position.costBasisCents,
      ledgerValueCents: position.currentValueCents,
      ledgerPriceDate: instrument.price_observed_at ? instrument.price_observed_at.slice(0, 10) : null,
      mark,
      informed,
      estimate,
      today,
    });
    return { instrument, terms, position, resolved };
  }));
}
