import { BottomNav } from "@/components/navigation/bottom-nav";

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return <><main className="shell"><header className="topbar"><span className="wordmark">north.</span><span className="avatar" aria-label="Perfil de Marina">MS</span></header>{children}</main><BottomNav active={active} /></>;
}
