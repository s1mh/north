import { describe, expect, it } from "vitest";
import {
  brazilianMoneySubmissionValue,
  completeBrazilianMoneyInput,
  formatBrazilianMoneyInput,
} from "@/features/goals/money-input";

describe("Brazilian money input", () => {
  it("groups the integer part while the user types", () => {
    expect(formatBrazilianMoneyInput("10000")).toBe("R$ 10.000");
    expect(formatBrazilianMoneyInput("10000,00")).toBe("R$ 10.000,00");
    expect(formatBrazilianMoneyInput("10000.00")).toBe("R$ 10.000,00");
  });

  it("limits decimals and completes cents on blur", () => {
    expect(formatBrazilianMoneyInput("530,0099")).toBe("R$ 530,00");
    expect(completeBrazilianMoneyInput("530")).toBe("R$ 530,00");
    expect(completeBrazilianMoneyInput("0,5")).toBe("R$ 0,50");
    expect(completeBrazilianMoneyInput("")).toBe("");
  });

  it("removes the visual currency prefix before submission", () => {
    expect(brazilianMoneySubmissionValue("R$ 1.000,00")).toBe("1.000,00");
    expect(brazilianMoneySubmissionValue("")).toBe("");
  });
});
