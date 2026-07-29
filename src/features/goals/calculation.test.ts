import { describe, expect, it } from "vitest";
import { deriveGoalProgress, getActiveContributionPlan } from "@/features/goals/calculation";

describe("goal progress", () => {
  it("derives progress and monthly requirement from the ledger", () => {
    expect(deriveGoalProgress({
      targetAmount: "25000.00",
      targetDate: "2027-12-01",
      contributions: ["9000.00", "200.00"],
      plannedMonthlyAmount: "530.00",
      today: "2026-07-28",
    })).toEqual({
      targetCents: 2_500_000n,
      contributedCents: 920_000n,
      remainingCents: 1_580_000n,
      monthsRemaining: 17,
      requiredMonthlyCents: 92_942n,
      plannedMonthlyCents: 53_000n,
      monthlyGapCents: 39_942n,
      percentage: 36.8,
      completed: false,
    });
  });

  it("caps completed progress and never returns a negative remainder", () => {
    const result = deriveGoalProgress({
      targetAmount: "1000",
      targetDate: "2026-08-01",
      contributions: ["1200"],
      today: "2026-07-28",
    });
    expect(result.percentage).toBe(100);
    expect(result.remainingCents).toBe(0n);
    expect(result.requiredMonthlyCents).toBe(0n);
    expect(result.completed).toBe(true);
  });

  it("handles a deadline in the current month without division by zero", () => {
    const result = deriveGoalProgress({
      targetAmount: "1000",
      targetDate: "2026-07-31",
      contributions: [],
      today: "2026-07-28",
    });
    expect(result.monthsRemaining).toBe(1);
    expect(result.requiredMonthlyCents).toBe(100_000n);
  });

  it("normalizes Supabase one-to-one and array relation shapes", () => {
    const active = { amount: "530.00", status: "active" };
    expect(getActiveContributionPlan(active)).toEqual(active);
    expect(getActiveContributionPlan([active])).toEqual(active);
    expect(getActiveContributionPlan({ amount: "530.00", status: "paused" })).toBeUndefined();
    expect(getActiveContributionPlan(null)).toBeUndefined();
  });
});
