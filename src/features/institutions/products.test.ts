import { describe, expect, it } from "vitest";
import {
  comparisonPrompt,
  isProductReviewOverdue,
  productInstitution,
} from "@/features/institutions/products";

describe("product presentation", () => {
  it("marks a review as overdue only after its due date", () => {
    expect(isProductReviewOverdue("2026-07-29", "2026-07-30")).toBe(true);
    expect(isProductReviewOverdue("2026-07-30", "2026-07-30")).toBe(false);
  });

  it("normalizes a Supabase to-one relation", () => {
    const institution = { id: "1", name: "Banco", initial: "B", color_token: "rf" };
    expect(productInstitution({ institutions: [institution] } as never)).toEqual(institution);
  });

  it("keeps comparisons educational for every profile", () => {
    expect(comparisonPrompt("moderado", "Diária")).toContain("compare");
    expect(comparisonPrompt("arrojado", "No vencimento")).toContain("risco de crédito");
  });
});
