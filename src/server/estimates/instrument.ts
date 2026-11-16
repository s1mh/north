import "server-only";
import { DAILY_SERIES, fetchDailySeries } from "@/features/estimates/bcb-daily";
import { estimateIndexed, type Flow, type IndexedTerms } from "@/features/estimates/indexed";
import type { TaxRegime } from "@/features/estimates/tax";
import type { InstrumentTerms } from "@/features/portfolio/terms";
import { rateLabel } from "@/features/portfolio/terms";

type TransactionLike = {
  id?: string;
  transaction_type: string;
  quantity: string | number;
  unit_price: string | number;
  trade_date: string;
  reverses_transaction_id?: string | null;
};

export type EstimateView = {
  /** Valores em reais. */
  gross: number;
  net: number | null;
  taxes: number | null;
  principal: number;
  throughDate: string;
  businessDays: number;
  rateText: string;
  regime: TaxRegime;
  /** Estimativa na data do último valor informado (para conferir com o banco). */
  atInformed: { date: string; gross: number; net: number | null } | null;
};

export function flowsFromTransactions(transactions: readonly TransactionLike[]): Flow[] {
  const reversed = new Set(
    transactions.map((t) => t.reverses_transaction_id).filter((id): id is string => Boolean(id)),
  );
  const flows: Flow[] = [];
  for (const t of transactions) {
    if (t.reverses_transaction_id || (t.id && reversed.has(t.id))) continue;
    const amount = Number(t.quantity) * Number(t.unit_price);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (t.transaction_type === "compra" || t.transaction_type === "aporte") {
      flows.push({ date: t.trade_date, amount });
    } else if (t.transaction_type === "venda" || t.transaction_type === "resgate") {
      flows.push({ date: t.trade_date, amount: -amount });
    }
  }
  return flows;
}

function regimeFor(terms: InstrumentTerms): TaxRegime {
  if (terms.tax_regime === "regressivo") return "regressivo";
  if (terms.tax_regime === "isento") return "isento";
  if (!terms.tax_regime && (terms.product_type === "lci" || terms.product_type === "lca")) return "isento";
  return "unknown";
}

/** Estima o saldo pelo contrato e pelo índice público do Banco Central. Devolve null se não der para estimar. */
export async function estimateInstrument({
  transactions,
  terms,
  asOf,
  informedOn,
}: {
  transactions: readonly TransactionLike[];
  terms: InstrumentTerms | null;
  asOf: string;
  informedOn?: string | null;
}): Promise<EstimateView | null> {
  if (!terms || !terms.indexer || terms.rate === null || terms.rate === undefined) return null;
  const rate = Number(terms.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const indexed: IndexedTerms | null = terms.indexer === "cdi_pct" || terms.indexer === "selic_pct"
    ? { indexer: terms.indexer, rate }
    : terms.indexer === "pre" ? { indexer: "pre", rate } : null;
  if (!indexed) return null; // IPCA+ e poupança ficam para a próxima etapa

  const flows = flowsFromTransactions(transactions);
  if (flows.length === 0) return null;
  const from = flows.reduce((first, flow) => (flow.date < first ? flow.date : first), flows[0]!.date);
  const seriesCode = indexed.indexer === "selic_pct" ? DAILY_SERIES.selic_pct : DAILY_SERIES.cdi_pct;
  const series = await fetchDailySeries(seriesCode, from, asOf);
  if (!series) return null;

  const regime = regimeFor(terms);
  const today = estimateIndexed({ flows, terms: indexed, series, asOf, regime });
  if (!today) return null;
  const atInformed = informedOn && informedOn < asOf
    ? estimateIndexed({ flows, terms: indexed, series, asOf: informedOn, regime })
    : null;

  return {
    gross: today.gross,
    net: today.net,
    taxes: today.taxes,
    principal: today.principal,
    throughDate: today.throughDate,
    businessDays: today.businessDays,
    rateText: rateLabel(terms.indexer, terms.rate) ?? "",
    regime,
    atInformed: atInformed && informedOn
      ? { date: informedOn, gross: atInformed.gross, net: atInformed.net }
      : null,
  };
}
