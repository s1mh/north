import { treasurySourceIdFromTerms } from "@/features/market/treasury-titles";

export type ValueSource =
  | "mercado"
  | "tesouro"
  | "informado"
  | "estimado_ancorado"
  | "estimado_contrato"
  | "lancamento"
  | "custo";

export type Mark = { price: number; observedOn: string; kind: "b3" | "tesouro" };

export type ValueInput = {
  /** Quantidade em unidades (ex.: 500 ou 0,5 título). */
  quantity: number;
  costBasisCents: bigint;
  /** Valor pelo preço do último lançamento (ou do último valor informado), se houver preço. */
  ledgerValueCents: bigint | null;
  ledgerPriceDate: string | null;
  mark: Mark | null;
  /** Último valor informado que ainda vale (o preço do ativo continua sendo o dele). */
  informed: { date: string; totalCents: bigint } | null;
  /** Estimativa pelo contrato (reais), quando a ficha permite. */
  estimate: {
    now: number;
    atInformed: number | null;
  } | null;
  today: string;
};

export type ResolvedValue = {
  valueCents: bigint;
  source: ValueSource;
  asOf: string | null;
  /** Marcação de mercado com mais de 7 dias corridos. */
  stale: boolean;
  /** Valor estimado (mostrar com ≈ e o aviso). */
  estimated: boolean;
};

const STALE_MARK_DAYS = 7;

function daysBetween(fromIso: string, toIso: string) {
  const from = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
  const to = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
  return Math.round((to - from) / 86_400_000);
}

const toCents = (reais: number) => BigInt(Math.round(reais * 100));

/**
 * Qual valor mostrar para uma posição:
 * 1) preço de mercado (B3/Tesouro) ou valor informado, o que tiver a data mais recente (empate: mercado);
 * 2) valor informado + o rendimento estimado desde a data informada (âncora), se a ficha permitir;
 * 3) estimativa pelo contrato, sem valor informado;
 * 4) preço do último lançamento; 5) custo.
 */
export function resolveValue(input: ValueInput): ResolvedValue {
  const { mark, informed, estimate, today } = input;

  const markWins = mark && (!informed || mark.observedOn >= informed.date);
  if (mark && markWins && input.quantity > 0) {
    return {
      valueCents: toCents(input.quantity * mark.price),
      source: mark.kind === "tesouro" ? "tesouro" : "mercado",
      asOf: mark.observedOn,
      stale: daysBetween(mark.observedOn, today) > STALE_MARK_DAYS,
      estimated: false,
    };
  }

  if (informed) {
    if (estimate && estimate.atInformed !== null && informed.date < today) {
      const delta = estimate.now - estimate.atInformed;
      return {
        valueCents: informed.totalCents + toCents(Math.max(delta, 0)),
        source: "estimado_ancorado",
        asOf: informed.date,
        stale: false,
        estimated: delta > 0.004,
      };
    }
    return { valueCents: informed.totalCents, source: "informado", asOf: informed.date, stale: false, estimated: false };
  }

  if (estimate && input.quantity > 0) {
    return {
      valueCents: toCents(estimate.now),
      source: "estimado_contrato",
      asOf: today,
      stale: false,
      estimated: true,
    };
  }

  if (input.ledgerValueCents !== null) {
    return { valueCents: input.ledgerValueCents, source: "lancamento", asOf: input.ledgerPriceDate, stale: false, estimated: false };
  }
  return { valueCents: input.costBasisCents, source: "custo", asOf: null, stale: false, estimated: false };
}

/** Como achar o preço de mercado de um ativo: código B3 ou título do Tesouro. */
export function marketKeyFor(
  instrument: { symbol: string; asset_class: string },
  terms: { product_type: string | null; maturity_date: string | null } | null,
): { kind: "b3"; symbol: string } | { kind: "tesouro"; sourceInstrumentId: string } | null {
  const treasury = treasurySourceIdFromTerms(terms?.product_type, terms?.maturity_date);
  if (treasury) return { kind: "tesouro", sourceInstrumentId: treasury };
  const symbol = instrument.symbol.trim().toUpperCase();
  if (["acoes", "fiis", "fundos"].includes(instrument.asset_class) && /^[A-Z]{4}\d{1,2}$/.test(symbol)) {
    return { kind: "b3", symbol };
  }
  return null;
}

const dateLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Frase curta de origem do valor, para listas e telas. */
export function valueSourceLabel(value: ResolvedValue) {
  const date = value.asOf ? dateLabel(value.asOf) : "";
  switch (value.source) {
    case "mercado": return `preço de mercado de ${date} (B3)${value.stale ? " · desatualizado" : ""}`;
    case "tesouro": return `preço do Tesouro de ${date}${value.stale ? " · desatualizado" : ""}`;
    case "informado": return `informado por você em ${date}`;
    case "estimado_ancorado": return value.estimated
      ? `≈ estimado a partir do valor informado em ${date}`
      : `informado por você em ${date}`;
    case "estimado_contrato": return "≈ estimado pelo contrato";
    case "lancamento": return date ? `preço do último lançamento de ${date}` : "preço do último lançamento";
    default: return "sem preço atual (custo)";
  }
}

export const ESTIMATE_DISCLAIMER =
  "Valores com ≈ são estimativas feitas pelo north. a partir do contrato e dos índices públicos. O valor real é o do seu banco ou corretora.";
