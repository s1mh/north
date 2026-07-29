import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPrivateEnv } from "@/server/env/private";
import { getPublicEnv } from "@/server/env/public";

export function createMarketAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SECRET_KEY } = getPrivateEnv();

  if (!SUPABASE_SECRET_KEY) {
    throw new Error("market_admin_not_configured");
  }

  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
