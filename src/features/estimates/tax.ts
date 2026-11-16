/** Imposto estimado sobre o rendimento de renda fixa (tabela regressiva de IR e IOF dos primeiros 30 dias). */

// IOF regressivo sobre o rendimento: dia 1 = 96% ... dia 29 = 3%; a partir do dia 30, zero.
const IOF_BY_DAY = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50,
  46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3,
];

export function iofRate(ageDays: number) {
  if (ageDays < 1) return IOF_BY_DAY[0]! / 100;
  if (ageDays > IOF_BY_DAY.length) return 0;
  return (IOF_BY_DAY[ageDays - 1] ?? 0) / 100;
}

export function irRegressiveRate(ageDays: number) {
  if (ageDays <= 180) return 0.225;
  if (ageDays <= 360) return 0.2;
  if (ageDays <= 720) return 0.175;
  return 0.15;
}

export type TaxRegime = "regressivo" | "isento" | "unknown";

/** Bruto, impostos e líquido de um lote com `grossYield` de rendimento e `ageDays` desde a aplicação. */
export function netOfTaxes(principal: number, grossYield: number, ageDays: number, regime: TaxRegime) {
  const yieldValue = Math.max(0, grossYield);
  if (regime === "isento") return { iof: 0, ir: 0, net: principal + grossYield };
  if (regime !== "regressivo") return { iof: 0, ir: 0, net: null as number | null };
  const iof = yieldValue * iofRate(ageDays);
  const ir = (yieldValue - iof) * irRegressiveRate(ageDays);
  return { iof, ir, net: principal + grossYield - iof - ir };
}
