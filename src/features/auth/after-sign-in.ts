import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthenticatedDestination } from "@/features/auth/onboarding";

/** Para onde a pessoa vai depois de entrar (depois do segundo fator, se houver). */
export async function destinationAfterSignIn(supabase: SupabaseClient) {
  const [{ data: profile }, { count: linkedInstitutionCount }] = await Promise.all([
    supabase.from("profiles").select("onboarding, current_assessment_id").maybeSingle(),
    supabase.from("user_institutions").select("*", { count: "exact", head: true }),
  ]);
  return resolveAuthenticatedDestination({
    onboarding: profile?.onboarding,
    currentAssessmentId: profile?.current_assessment_id,
    linkedInstitutionCount,
  });
}

/** True quando a conta tem segundo fator e esta sessão ainda não passou por ele. */
export async function needsSecondFactor(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}
