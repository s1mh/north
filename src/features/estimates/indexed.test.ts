import { describe, expect, it } from "vitest";
import { parseDailyPayload } from "./bcb-daily";
import { estimateIndexed, growthFactor, type DailyRate } from "./indexed";
import { iofRate, irRegressiveRate, netOfTaxes } from "./tax";

// 10 dias úteis consecutivos a 0,05% ao dia.
const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const series: DailyRate[] = days.map((date) => ({ date, pct: 0.05 }));
const cdi120 = { indexer: "cdi_pct" as const, rate: 120 };

describe("imposto", () => {
  it("IR regressivo por faixa e IOF só nos primeiros 30 dias", () => {
    expect(irRegressiveRate(10)).toBe(0.225);
    expect(irRegressiveRate(180)).toBe(0.225);
    expect(irRegressiveRate(181)).toBe(0.2);
    expect(irRegressiveRate(361)).toBe(0.175);
    expect(irRegressiveRate(721)).toBe(0.15);
    expect(iofRate(1)).toBe(0.96);
    expect(iofRate(29)).toBe(0.03);
    expect(iofRate(30)).toBe(0);
  });

  it("reproduz o caso do print: 9,53 de rendimento em 47 dias -> IR de 2,14 e líquido de 507,39", () => {
    const result = netOfTaxes(500, 9.53, 47, "regressivo");
    expect(result.iof).toBe(0);
    expect(result.ir).toBeCloseTo(2.14, 2);
    expect(result.net).toBeCloseTo(507.39, 2);
  });

  it("isento não desconta; regime desconhecido não inventa o líquido", () => {
    expect(netOfTaxes(1000, 50, 100, "isento").net).toBe(1050);
    expect(netOfTaxes(1000, 50, 100, "unknown").net).toBeNull();
  });
});

describe("growthFactor", () => {
  it("120% do CDI acumula dia útil a dia útil (só depois da data de aplicação)", () => {
    const { factor, days: n } = growthFactor(series, cdi120, "2026-10-01", "2026-10-10");
    expect(n).toBe(9);
    expect(factor).toBeCloseTo((1 + 0.0005 * 1.2) ** 9, 12);
  });
  it("prefixado usa 252 dias úteis por ano", () => {
    const { factor } = growthFactor(series, { indexer: "pre", rate: 12 }, "2026-10-01", "2026-10-10");
    expect(factor).toBeCloseTo(1.12 ** (9 / 252), 12);
  });
});

describe("estimateIndexed", () => {
  it("um aporte: bruto, imposto e líquido", () => {
    const result = estimateIndexed({
      flows: [{ date: "2026-10-01", amount: 500 }], terms: cdi120, series, asOf: "2026-10-10", regime: "regressivo",
    })!;
    const gross = 500 * (1 + 0.0005 * 1.2) ** 9;
    expect(result.gross).toBeCloseTo(gross, 8);
    expect(result.principal).toBe(500);
    expect(result.businessDays).toBe(9);
    // 9 dias de idade: IOF de 70% do rendimento e IR sobre o resto.
    const y = gross - 500;
    expect(result.net).toBeCloseTo(500 + y - y * 0.7 - (y - y * 0.7) * 0.225, 8);
  });

  it("dois aportes: cada lote rende desde a própria data", () => {
    const result = estimateIndexed({
      flows: [{ date: "2026-10-01", amount: 500 }, { date: "2026-10-06", amount: 200 }],
      terms: cdi120, series, asOf: "2026-10-10", regime: "isento",
    })!;
    const expected = 500 * (1 + 0.0006) ** 9 + 200 * (1 + 0.0006) ** 4;
    expect(result.gross).toBeCloseTo(expected, 8);
    expect(result.net).toBeCloseTo(expected, 8);
  });

  it("resgate sai do lote mais antigo", () => {
    const result = estimateIndexed({
      flows: [{ date: "2026-10-01", amount: 500 }, { date: "2026-10-03", amount: -300 }],
      terms: cdi120, series, asOf: "2026-10-10", regime: "isento",
    })!;
    const afterRedeem = 500 * (1 + 0.0006) ** 2 - 300;
    expect(result.gross).toBeCloseTo(afterRedeem * (1 + 0.0006) ** 7, 8);
  });

  it("sem série ou sem lançamentos não estima", () => {
    expect(estimateIndexed({ flows: [], terms: cdi120, series, asOf: "2026-10-10", regime: "isento" })).toBeNull();
    expect(estimateIndexed({ flows: [{ date: "2026-10-01", amount: 500 }], terms: cdi120, series: [], asOf: "2026-10-10", regime: "isento" })).toBeNull();
  });

  it("usa só a série até a data pedida", () => {
    const result = estimateIndexed({
      flows: [{ date: "2026-10-01", amount: 500 }], terms: cdi120, series, asOf: "2026-10-05", regime: "isento",
    })!;
    expect(result.throughDate).toBe("2026-10-05");
    expect(result.businessDays).toBe(4);
  });
});

describe("parseDailyPayload", () => {
  it("converte as datas do Banco Central e descarta valores absurdos", () => {
    const rows = parseDailyPayload([
      { data: "30/09/2026", valor: "0.050788" },
      { data: "01/10/2026", valor: "9.5" },
    ]);
    expect(rows).toEqual([{ date: "2026-09-30", pct: 0.050788 }]);
  });
});
