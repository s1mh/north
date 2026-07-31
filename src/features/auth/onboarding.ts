export type OnboardingState = {
  onboarding?: string | null;
  currentAssessmentId?: string | null;
  linkedInstitutionCount?: number | null;
};

export function resolveAuthenticatedDestination({
  onboarding,
  currentAssessmentId,
  linkedInstitutionCount,
}: OnboardingState) {
  if (onboarding === "complete" || currentAssessmentId) return "/inicio";
  if ((linkedInstitutionCount ?? 0) > 0) return "/onboarding/perfil";
  return "/onboarding/bancos";
}
