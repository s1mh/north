import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/server/env/public";

/**
 * Confere a senha atual sem tocar na sessão do navegador.
 * Um login normal criaria outra sessão (aal1) e derrubaria o segundo fator.
 */
export async function verifyCurrentPassword(email: string, password: string) {
  const env = getPublicEnv();
  const isolated = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  );
  const { error } = await isolated.auth.signInWithPassword({ email, password });
  return !error;
}
