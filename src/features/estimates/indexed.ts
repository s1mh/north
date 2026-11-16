import { netOfTaxes, type TaxRegime } from "./tax";

export type DailyRate = { date: string; pct: number };

export type Flow = {
  date: string;
  /** Valor em reais; positivo = entrou (compra/aporte), negativo = saiu (venda/resgate). */
  amount: number;
};

export type IndexedTerms =
  | { indexer: "cdi_pct" | "selic_pct"; rate: number }
  | { indexer: "pre"; rate: number };

export type Estimate = {
  gross: number;
  net: number | null;
  taxes: number | null;
  principal: number;
  businessDays: number;
  /** Última data da série usada (limite do cálculo). */
  throughDate: string;
};

function daysBetween(fromIso: string, toIso: string) {
  const from = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
  const to = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
  return Math.round((to - from) / 86_400_000);
}

/** Fator de crescimento entre duas datas: cada dia útil da série, estritamente depois de `from` e até `to`. */
export function growthFactor(series: readonly DailyRate[], terms: IndexedTerms, from: string, to: string) {
  let factor = 1;
  let days = 0;
  for (const row of series) {
    if (row.date <= from || row.date > to) continue;
    days += 1;
    if (terms.indexer === "pre") factor *= (1 + terms.rate / 100) ** (1 / 252);
    else factor *= 1 + (row.pct / 100) * (terms.rate / 100);
  }
  return { factor, days };
}

type Lot = { date: string; principal: number; value: number; lastDate: string };

/**
 * Estima o saldo hoje a partir dos lançamentos (cada aplicação é um lote) e do índice público.
 * Resgates saem dos lotes mais antigos primeiro (como os bancos fazem para o imposto).
 */
export function estimateIndexed({
  flows,
  terms,
  series,
  asOf,
  regime,
}: {
  flows: readonly Flow[];
  terms: IndexedTerms;
  series: readonly DailyRate[];
  asOf: string;
  regime: TaxRegime;
}): Estimate | null {
  const ordered = [...flows].filter((flow) => flow.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length === 0 || series.length === 0) return null;
  const throughDate = series.reduce((last, row) => (row.date > last && row.date <= asOf ? row.date : last), "");
  if (!throughDate) return null;

  const lots: Lot[] = [];
  let totalDays = 0;
  for (const flow of ordered) {
    // Faz todos os lotes crescerem até a data do lançamento.
    for (const lot of lots) {
      const { factor } = growthFactor(series, terms, lot.lastDate, flow.date);
      lot.value *= factor;
      lot.lastDate = flow.date;
    }
    if (flow.amount > 0) {
      lots.push({ date: flow.date, principal: flow.amount, value: flow.amount, lastDate: flow.date });
    } else {
      let remaining = -flow.amount;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.value, remaining);
        const share = lot.value > 0 ? take / lot.value : 0;
        lot.principal -= lot.principal * share;
        lot.value -= take;
        remaining -= take;
      }
    }
  }

  let gross = 0;
  let principal = 0;
  let net = 0;
  let taxes = 0;
  let netKnown = true;
  for (const lot of lots) {
    const { factor, days } = growthFactor(series, terms, lot.lastDate, throughDate);
    totalDays = Math.max(totalDays, growthFactor(series, terms, lot.date, throughDate).days || days);
    const value = lot.value * factor;
    const grossYield = value - lot.principal;
    const age = daysBetween(lot.date, throughDate);
    const result = netOfTaxes(lot.principal, grossYield, age, regime);
    gross += value;
    principal += lot.principal;
    if (result.net === null) netKnown = false;
    else {
      net += result.net;
      taxes += result.iof + result.ir;
    }
  }

  return {
    gross,
    net: netKnown ? net : null,
    taxes: netKnown ? taxes : null,
    principal,
    businessDays: totalDays,
    throughDate,
  };
}
