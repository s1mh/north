import Link from "next/link";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { SignOutButton } from "@/features/auth/sign-out-button";

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return <><main className="shell"><header className="topbar"><span className="wordmark">north.</span><div className="topbar-actions"><SignOutButton /><Link className="avatar" href="/onboarding/perfil" aria-label="Ver meu perfil de investidor">MS</Link></div></header>{children}</main><BottomNav active={active} /></>;
}
