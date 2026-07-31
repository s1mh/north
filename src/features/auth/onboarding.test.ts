import { describe, expect, it } from "vitest";
import { resolveAuthenticatedDestination } from "@/features/auth/onboarding";

describe("authenticated onboarding destination", () => {
  it("starts a new account at bank selection", () => {
    expect(resolveAuthenticatedDestination({ onboarding: "suitability" }))
      .toBe("/onboarding/bancos");
  });

  it("resumes at suitability after banks were selected", () => {
    expect(resolveAuthenticatedDestination({
      onboarding: "suitability",
      linkedInstitutionCount: 2,
    })).toBe("/onboarding/perfil");
  });

  it("sends completed accounts home", () => {
    expect(resolveAuthenticatedDestination({
      onboarding: "complete",
      currentAssessmentId: "assessment-id",
    })).toBe("/inicio");
  });
});
