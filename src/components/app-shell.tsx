import Link from "next/link";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { profileInitials } from "@/features/profile/initials";
import { createClient } from "@/server/supabase/client";

export async function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .maybeSingle();
  const initials = profileInitials(profile?.display_name);

  return <><main className="shell"><header className="topbar"><span className="wordmark">north.</span><div className="topbar-actions"><SignOutButton /><Link className="avatar" href="/perfil" aria-label={`Abrir conta e ajustes de ${profile?.display_name ?? "seu perfil"}`}>{initials}</Link></div></header>{children}</main><BottomNav active={active} /></>;
}
