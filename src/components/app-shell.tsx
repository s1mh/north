import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { profileInitials } from "@/features/profile/initials";
import { createClient } from "@/server/supabase/client";

/** O nome vem do próprio token de login: evita uma ida ao banco em toda tela. */
async function displayName() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const fromToken = (data?.claims?.user_metadata as { display_name?: unknown } | undefined)?.display_name;
  if (typeof fromToken === "string" && fromToken.trim()) return fromToken;
  const { data: profile } = await supabase.from("profiles").select("display_name").maybeSingle();
  return profile?.display_name as string | null | undefined;
}

export async function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  const name = await displayName();
  const initials = profileInitials(name);

  return <><main className="shell"><header className="topbar"><span className="wordmark">north.</span><div className="topbar-actions"><SignOutButton /><Link className="avatar" href="/perfil" aria-label={`Abrir conta e ajustes de ${name ?? "seu perfil"}`}>{initials}</Link></div></header>{children}<SiteFooter compact /></main><BottomNav active={active} /></>;
}
