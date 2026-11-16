import { describe, expect, it } from "vitest";
import { gainFromCents, quantityForAmount } from "./valuation";
import { describeTerms, instrumentTermsInputSchema, isBalanceProduct, rateLabel } from "./terms";

describe("rateLabel", () => {
  it("escreve a taxa do jeito que a pessoa fala", () => {
    expect(rateLabel("cdi_pct", 120)).toBe("120% do CDI");
    expect(rateLabel("ipca_mais", "6.5")).toBe("IPCA + 6,5% ao ano");
    expect(rateLabel("pre", 11)).toBe("11% ao ano");
    expect(rateLabel("cdi_pct", null)).toBeNull();
  });
});

describe("describeTerms", () => {
  it("lista só o que foi preenchido, em português", () => {
    const rows = describeTerms({
      product_type: "rdb", issuer: "Nu Financeira", indexer: "cdi_pct", rate: 120,
      start_date: "2026-09-30", maturity_date: "2028-09-29", liquidity: "diaria", liquidity_days: null,
      fgc: "sim", tax_regime: null,
    });
    expect(rows.map((row) => row.label)).toEqual(["Tipo", "Emissor", "Rendimento", "Início", "Vencimento", "Liquidez", "FGC"]);
    expect(rows.find((row) => row.label === "Vencimento")?.value).toBe("29/09/2028");
    expect(rows.find((row) => row.label === "Liquidez")?.value).toBe("Diária");
    expect(describeTerms(null)).toEqual([]);
  });
});

describe("instrumentTermsInputSchema", () => {
  it("aceita a ficha do exemplo e normaliza a taxa", () => {
    const parsed = instrumentTermsInputSchema.parse({
      product_type: "rdb", indexer: "cdi_pct", rate: "120", maturity_date: "2028-09-29", fgc: "sim",
    });
    expect(parsed.rate).toBe(120);
  });
  it("recusa campos desconhecidos, taxa absurda e vencimento antes do início", () => {
    expect(instrumentTermsInputSchema.safeParse({ preco: 1 }).success).toBe(false);
    expect(instrumentTermsInputSchema.safeParse({ rate: 5000 }).success).toBe(false);
    expect(instrumentTermsInputSchema.safeParse({ start_date: "2026-10-01", maturity_date: "2026-09-01" }).success).toBe(false);
  });
  it("saldo: rdb e caixinha escondem quantidade; fundo não", () => {
    expect(isBalanceProduct("rdb")).toBe(true);
    expect(isBalanceProduct("conta_remunerada")).toBe(true);
    expect(isBalanceProduct("fundo")).toBe(false);
    expect(isBalanceProduct(null)).toBe(false);
  });
});

describe("valuation", () => {
  it("ganho do exemplo: 500 viram 507,39", () => {
    const { gainCents, percent } = gainFromCents(50_000n, 50_739n);
    expect(gainCents).toBe(739n);
    expect(percent).toBeCloseTo(1.47, 1);
    expect(gainFromCents(0n, 100n).percent).toBeNull();
  });
  it("um aporte de R$ 200 ao preço atual compra 200 ÷ preço cotas", () => {
    expect(quantityForAmount("200", 1.01478)).toBe("197.08705335");
    expect(quantityForAmount("0", 1)).toBeNull();
    expect(quantityForAmount("abc", 1)).toBeNull();
  });
});
