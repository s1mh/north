import { describe, expect, it } from "vitest";
import { goalContributionSchema, goalSchema } from "@/features/goals/submission";

describe("goal submissions", () => {
  it("normalizes Brazilian money without using floating point", () => {
    const result = goalSchema.parse({
      name: "Viagem Japão",
      kind: "viagem",
      targetAmount: "25.000,00",
      targetDate: "2030-12-01",
      plannedMonthlyAmount: "530,00",
    });
    expect(result.targetAmount).toBe("25000.00");
    expect(result.plannedMonthlyAmount).toBe("530.00");
  });

  it("rejects past dates, negative plans and unknown fields", () => {
    expect(goalSchema.safeParse({
      name: "Viagem",
      kind: "viagem",
      targetAmount: "1000",
      targetDate: "2020-01-01",
      plannedMonthlyAmount: "100",
    }).success).toBe(false);
    expect(goalSchema.safeParse({
      name: "Viagem",
      kind: "viagem",
      targetAmount: "1000",
      targetDate: "2030-01-01",
      plannedMonthlyAmount: "-1",
    }).success).toBe(false);
    expect(goalSchema.safeParse({
      name: "Viagem",
      kind: "viagem",
      targetAmount: "1000",
      targetDate: "2030-01-01",
      plannedMonthlyAmount: "100",
      userId: crypto.randomUUID(),
    }).success).toBe(false);
  });

  it("accepts an optional contribution note and rejects future entries", () => {
    expect(goalContributionSchema.safeParse({
      goalId: crypto.randomUUID(),
      amount: "250,50",
      contributedOn: "2026-07-28",
      note: "",
    }).success).toBe(true);
    expect(goalContributionSchema.safeParse({
      goalId: crypto.randomUUID(),
      amount: "250,50",
      contributedOn: "2030-01-01",
      note: "",
    }).success).toBe(false);
  });
});
