import { describe, expect, it } from "vitest";
import {
  derivePosition,
  formatMoneyFromCents,
  formatQuantity,
  getPriceStatus,
  transactionValueCents,
  type PortfolioTransaction,
} from "./ledger";

function transaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    transaction_type: "compra",
    quantity: "10",
    unit_price: "12.34",
    fees: "0",
    ...overrides,
  };
}

describe("portfolio ledger", () => {
  it("calculates values without binary floating point", () => {
    const result = derivePosition([transaction({ quantity: "0.3", unit_price: "0.10" })], "0.10");
    expect(result.costBasisCents).toBe(3n);
    expect(result.currentValueCents).toBe(3n);
  });

  it("rounds a purchase to cents and includes fees", () => {
    const result = derivePosition([transaction({ quantity: "3", unit_price: "10.005", fees: "1.25" })], null);
    expect(result.costBasisCents).toBe(3127n);
  });

  it("removes proportional cost on a partial sale", () => {
    const result = derivePosition([
      transaction({ quantity: "10", unit_price: "10", fees: "1" }),
      transaction({ transaction_type: "venda", quantity: "4", unit_price: "12" }),
    ], "12");
    expect(result.quantity).toBe(600000000n);
    expect(result.costBasisCents).toBe(6060n);
    expect(result.currentValueCents).toBe(7200n);
  });

  it("keeps missing price explicit", () => {
    expect(derivePosition([transaction()], null).currentValueCents).toBeNull();
  });

  it("rejects a negative position", () => {
    expect(() => derivePosition([
      transaction({ quantity: "1" }),
      transaction({ transaction_type: "venda", quantity: "2" }),
    ], null)).toThrow("insufficient position");
  });

  it("formats monetary values and fractional quantities in pt-BR", () => {
    expect(formatMoneyFromCents(123456n)).toBe("R$ 1.234,56");
    expect(formatQuantity(125000000n)).toBe("1,25");
  });

  it("tracks income and standalone fees without changing the position", () => {
    const result = derivePosition([
      transaction(),
      transaction({ transaction_type: "rendimento", quantity: "0", unit_price: "0", cash_amount: "25.50" }),
      transaction({ transaction_type: "taxa", quantity: "0", unit_price: "0", cash_amount: "3.25" }),
    ], "12.34");
    expect(result.quantity).toBe(1000000000n);
    expect(result.incomeCents).toBe(2550n);
    expect(result.expenseCents).toBe(325n);
  });

  it("calculates the displayed value for position and cash movements", () => {
    expect(transactionValueCents(transaction({ quantity: "2", unit_price: "12.345" }))).toBe(2469n);
    expect(transactionValueCents(transaction({
      transaction_type: "rendimento",
      quantity: "0",
      unit_price: "0",
      cash_amount: "9.99",
    }))).toBe(999n);
  });

  it("ignores an original transaction and its audit reversal", () => {
    const result = derivePosition([
      { ...transaction(), id: "original" },
      {
        ...transaction(),
        id: "reversal",
        reverses_transaction_id: "original",
        audit_reason: "Valor incorreto",
      },
      { ...transaction({ quantity: "8", unit_price: "13" }), id: "corrected", corrects_transaction_id: "original" },
    ], "13");
    expect(result.quantity).toBe(800000000n);
    expect(result.costBasisCents).toBe(10400n);
  });
});

describe("portfolio price status", () => {
  const now = new Date("2026-07-28T21:00:00-03:00");

  it("keeps a missing price explicit", () => {
    expect(getPriceStatus(null, null, now)).toBe("missing");
  });

  it("marks old prices as stale", () => {
    expect(getPriceStatus("10", "2026-07-26T00:00:00-03:00", now)).toBe("stale");
  });

  it("accepts a recent observed price", () => {
    expect(getPriceStatus("10", "2026-07-28T00:00:00-03:00", now)).toBe("current");
  });
});
