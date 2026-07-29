import { describe, expect, it } from "vitest";
import {
  allocationAmounts,
  deriveProjection,
  monthsUntilDate,
} from "@/features/investment/calculation";

describe("investment projection", () => {
  it("projects a one-off contribution with explicit net return and inflation", () => {
    expect(deriveProjection({
      contributionAmount: "5000.00",
      frequency: "once",
      horizonMonths: 12,
      annualReturnRate: 8,
      annualInflationRate: 4,
      annualFeeRate: 0.5,
    })).toEqual({
      contributedCents: 500000n,
      projectedNominalCents: 537500n,
      projectedRealCents: 516827n,
      annualNetRate: 0.075,
    });
  });

  it("handles a zero-return monthly plan without division by zero", () => {
    expect(deriveProjection({
      contributionAmount: "800",
      frequency: "monthly",
      horizonMonths: 18,
      annualReturnRate: 0,
      annualInflationRate: 0,
      annualFeeRate: 0,
    }).projectedNominalCents).toBe(1440000n);
  });

  it("rejects impossible and unsupported scenarios", () => {
    expect(() => deriveProjection({
      contributionAmount: "100",
      frequency: "once",
      horizonMonths: 0,
      annualReturnRate: 8,
      annualInflationRate: 4,
      annualFeeRate: 0,
    })).toThrow(RangeError);
    expect(() => deriveProjection({
      contributionAmount: "100",
      frequency: "once",
      horizonMonths: 12,
      annualReturnRate: 2,
      annualInflationRate: 4,
      annualFeeRate: 3,
    })).toThrow(RangeError);
  });

  it("preserves every cent while splitting the allocation", () => {
    expect(allocationAmounts("10.01", {
      "Renda Fixa": 40,
      "Ações · ETF": 25,
      FIIs: 15,
      Internacional: 10,
      Cripto: 10,
    }).reduce((total, item) => total + item.cents, 0n)).toBe(1001n);
  });

  it("derives a bounded monthly horizon from calendar dates", () => {
    expect(monthsUntilDate("2027-12-20", "2026-07-28")).toBe(17);
    expect(monthsUntilDate("2026-07-30", "2026-07-28")).toBe(1);
  });
});
