import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True quando a sessão cumpre o segundo fator (ou a conta não tem segundo fator). */
export async function sessionSatisfiesMfa(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("second_factor_status");
  return (data as { satisfied?: boolean } | null)?.satisfied !== false;
}
