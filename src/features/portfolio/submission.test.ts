import { describe, expect, it } from "vitest";
import { portfolioAssetSchema, portfolioTransactionSchema } from "./submission";

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

describe("portfolio transaction submission", () => {
  const movement = {
    instrumentId: "00000000-0000-4000-8000-000000000001",
    transactionType: "venda",
    quantity: "2,5",
    unitPrice: "38,20",
    fees: "1,00",
    cashAmount: "0",
    tradeDate: "2026-07-28",
  };

  it("normalizes a position movement", () => {
    const result = portfolioTransactionSchema.parse(movement);
    expect(result.quantity).toBe("2.5");
    expect(result.unitPrice).toBe("38.20");
  });

  it("accepts income only with a cash amount", () => {
    expect(portfolioTransactionSchema.safeParse({
      ...movement,
      transactionType: "rendimento",
      quantity: "0",
      unitPrice: "0",
      fees: "0",
      cashAmount: "25,50",
    }).success).toBe(true);
    expect(portfolioTransactionSchema.safeParse({
      ...movement,
      transactionType: "rendimento",
      cashAmount: "25,50",
    }).success).toBe(false);
  });

  it("rejects zero quantity, cash on a sale, and future dates", () => {
    expect(portfolioTransactionSchema.safeParse({ ...movement, quantity: "0" }).success).toBe(false);
    expect(portfolioTransactionSchema.safeParse({ ...movement, cashAmount: "10" }).success).toBe(false);
    expect(portfolioTransactionSchema.safeParse({ ...movement, tradeDate: "2099-01-01" }).success).toBe(false);
  });
});
