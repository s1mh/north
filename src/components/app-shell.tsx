import Link from "next/link";
import { BottomNav } from "@/components/navigation/bottom-nav";

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return <><main className="shell"><header className="topbar"><span className="wordmark">north.</span><Link className="avatar" href="/onboarding/perfil" aria-label="Descobrir meu perfil de investidor">MS</Link></header>{children}</main><BottomNav active={active} /></>;
}
