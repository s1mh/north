import { describe, expect, it } from "vitest";
import { investmentSimulationSchema } from "@/features/investment/submission";

const validSimulation = {
  mode: "free",
  goalId: null,
  frequency: "once",
  contributionAmount: "5.000,00",
  horizonMonths: 12,
  annualReturnRate: 8,
  annualInflationRate: 4,
  annualFeeRate: 0.5,
  allocation: {
    "Renda Fixa": 40,
    "Ações · ETF": 25,
    FIIs: 15,
    Internacional: 10,
    Cripto: 10,
  },
};

describe("investment simulation submission", () => {
  it("normalizes Brazilian money", () => {
    expect(investmentSimulationSchema.parse(validSimulation).contributionAmount).toBe("5000.00");
  });

  it("requires a goal only in goal mode", () => {
    expect(investmentSimulationSchema.safeParse({
      ...validSimulation,
      mode: "goal",
    }).success).toBe(false);
  });

  it("requires an allocation totaling exactly 100%", () => {
    expect(investmentSimulationSchema.safeParse({
      ...validSimulation,
      allocation: { ...validSimulation.allocation, Cripto: 9 },
    }).success).toBe(false);
  });

  it("rejects unsupported assumptions", () => {
    expect(investmentSimulationSchema.safeParse({
      ...validSimulation,
      annualReturnRate: 31,
    }).success).toBe(false);
    expect(investmentSimulationSchema.safeParse({
      ...validSimulation,
      annualReturnRate: 2,
      annualFeeRate: 3,
    }).success).toBe(false);
  });
});
