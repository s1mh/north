"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearNorthBrowserState } from "@/features/pwa/cache";

export function SignOutButton() {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function signOut() {
    setSending(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    await clearNorthBrowserState();
    router.replace("/");
    router.refresh();
  }

  return (
    <button className="sign-out" type="button" onClick={signOut} disabled={sending}>
      {sending ? "saindo…" : "sair"}
    </button>
  );
}
