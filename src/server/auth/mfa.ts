import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True quando a sessão cumpre o segundo fator (ou a conta não tem segundo fator). */
export async function sessionSatisfiesMfa(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!data) return false;
  return data.nextLevel !== "aal2" || data.currentLevel === "aal2";
}
