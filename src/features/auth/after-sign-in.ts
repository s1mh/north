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

export type SecondFactorStatus = { method: "totp" | "email" | null; satisfied: boolean };

/** Qual segundo fator a conta usa e se esta sessão já o cumpriu. */
export async function getSecondFactorStatus(supabase: SupabaseClient): Promise<SecondFactorStatus> {
  const { data } = await supabase.rpc("second_factor_status");
  const status = data as Partial<SecondFactorStatus> | null;
  return { method: status?.method ?? null, satisfied: status?.satisfied !== false };
}

/** True quando a conta tem segundo fator e esta sessão ainda não passou por ele. */
export async function needsSecondFactor(supabase: SupabaseClient) {
  const status = await getSecondFactorStatus(supabase);
  return status.method !== null && !status.satisfied;
}
