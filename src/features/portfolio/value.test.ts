import { describe, expect, it } from "vitest";
import { marketKeyFor, resolveValue, valueSourceLabel, type ValueInput } from "./value";

const base: ValueInput = {
  quantity: 100,
  costBasisCents: 100_000n,
  ledgerValueCents: 100_000n,
  ledgerPriceDate: "2026-09-30",
  mark: null,
  informed: null,
  estimate: null,
  today: "2026-11-16",
};

describe("resolveValue", () => {
  it("sem nada além do lançamento: usa o preço do último lançamento", () => {
    const v = resolveValue(base);
    expect(v.source).toBe("lancamento");
    expect(v.valueCents).toBe(100_000n);
    expect(v.estimated).toBe(false);
  });

  it("preço de mercado substitui o do lançamento e carrega a data", () => {
    const v = resolveValue({ ...base, mark: { price: 12.34, observedOn: "2026-11-13", kind: "b3" } });
    expect(v.source).toBe("mercado");
    expect(v.valueCents).toBe(123_400n);
    expect(v.asOf).toBe("2026-11-13");
    expect(v.stale).toBe(false);
    expect(valueSourceLabel(v)).toBe("preço de mercado de 13/11 (B3)");
  });

  it("mercado com mais de 7 dias fica marcado como desatualizado", () => {
    const v = resolveValue({ ...base, mark: { price: 10, observedOn: "2026-11-05", kind: "b3" } });
    expect(v.stale).toBe(true);
    expect(valueSourceLabel(v)).toMatch(/desatualizado/);
  });

  it("Tesouro: quantidade fracionária vezes o preço do título", () => {
    const v = resolveValue({ ...base, quantity: 0.5, mark: { price: 20_192.26, observedOn: "2026-11-13", kind: "tesouro" } });
    expect(v.source).toBe("tesouro");
    expect(v.valueCents).toBe(1_009_613n);
  });

  it("data mais recente vence: informado depois do fechamento fica com o informado", () => {
    const v = resolveValue({
      ...base,
      mark: { price: 10, observedOn: "2026-11-13", kind: "b3" },
      informed: { date: "2026-11-16", totalCents: 99_999n },
    });
    expect(v.source).toBe("informado");
    expect(v.valueCents).toBe(99_999n);
  });

  it("empate de data fica com o preço de mercado", () => {
    const v = resolveValue({
      ...base,
      mark: { price: 10, observedOn: "2026-11-13", kind: "b3" },
      informed: { date: "2026-11-13", totalCents: 99_999n },
    });
    expect(v.source).toBe("mercado");
  });

  it("valor informado antigo + estimativa: âncora = informado + rendimento estimado desde então", () => {
    const v = resolveValue({
      ...base,
      informed: { date: "2026-11-01", totalCents: 50_739n },
      estimate: { now: 508.0, atInformed: 506.5 },
    });
    expect(v.source).toBe("estimado_ancorado");
    expect(v.valueCents).toBe(50_739n + 150n);
    expect(v.estimated).toBe(true);
    expect(valueSourceLabel(v)).toBe("≈ estimado a partir do valor informado em 01/11");
  });

  it("informado hoje não é estimado", () => {
    const v = resolveValue({
      ...base,
      informed: { date: "2026-11-16", totalCents: 50_739n },
      estimate: { now: 508.0, atInformed: 507.9 },
    });
    expect(v.source).toBe("informado");
    expect(v.estimated).toBe(false);
  });

  it("sem valor informado, a estimativa pelo contrato vale (com ≈)", () => {
    const v = resolveValue({ ...base, estimate: { now: 507.15, atInformed: null } });
    expect(v.source).toBe("estimado_contrato");
    expect(v.valueCents).toBe(50_715n);
    expect(v.estimated).toBe(true);
  });

  it("sem preço nenhum: custo", () => {
    const v = resolveValue({ ...base, ledgerValueCents: null, ledgerPriceDate: null });
    expect(v.source).toBe("custo");
    expect(v.valueCents).toBe(100_000n);
  });
});

describe("marketKeyFor", () => {
  it("código de ação ou FII vira chave B3; texto livre não", () => {
    expect(marketKeyFor({ symbol: "petr4", asset_class: "acoes" }, null)).toEqual({ kind: "b3", symbol: "PETR4" });
    expect(marketKeyFor({ symbol: "MXRF11", asset_class: "fiis" }, null)).toEqual({ kind: "b3", symbol: "MXRF11" });
    expect(marketKeyFor({ symbol: "CAIXINHA_TURBO", asset_class: "renda_fixa" }, null)).toBeNull();
    expect(marketKeyFor({ symbol: "ABC", asset_class: "acoes" }, null)).toBeNull();
  });

  it("Tesouro precisa do tipo do título e do vencimento na ficha", () => {
    expect(marketKeyFor({ symbol: "TD1", asset_class: "renda_fixa" }, { product_type: "tesouro_selic", maturity_date: "2031-03-01" }))
      .toEqual({ kind: "tesouro", sourceInstrumentId: "Tesouro Selic|2031-03-01" });
    expect(marketKeyFor({ symbol: "TD1", asset_class: "renda_fixa" }, { product_type: "tesouro_selic", maturity_date: null })).toBeNull();
  });
});
