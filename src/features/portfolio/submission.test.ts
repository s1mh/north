import { describe, expect, it } from "vitest";
import { portfolioAssetSchema } from "./submission";

const valid = {
  institutionName: "Nubank",
  symbol: "petr4",
  name: "Petrobras PN",
  assetClass: "acoes",
  quantity: "10,5",
  unitPrice: "37,25",
  fees: "0,00",
  tradeDate: "2026-07-28",
};

describe("portfolio asset submission", () => {
  it("normalizes ticker and Brazilian decimals", () => {
    const result = portfolioAssetSchema.parse(valid);
    expect(result.symbol).toBe("PETR4");
    expect(result.quantity).toBe("10.5");
    expect(result.unitPrice).toBe("37.25");
  });

  it("rejects zero quantity and price", () => {
    expect(portfolioAssetSchema.safeParse({ ...valid, quantity: "0" }).success).toBe(false);
    expect(portfolioAssetSchema.safeParse({ ...valid, unitPrice: "0,00" }).success).toBe(false);
  });

  it("rejects future transactions and unknown fields", () => {
    expect(portfolioAssetSchema.safeParse({ ...valid, tradeDate: "2099-01-01" }).success).toBe(false);
    expect(portfolioAssetSchema.safeParse({ ...valid, secret: "no" }).success).toBe(false);
  });
});
