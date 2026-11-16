import { BottomNav } from "@/components/navigation/bottom-nav";

/** Esqueleto instantâneo: a navegação e a moldura aparecem na hora, o conteúdo chega em seguida. */
export function AppLoading({ active }: { active: string }) {
  return <>
    <main className="shell" aria-busy="true" aria-label="Carregando">
      <header className="topbar"><span className="wordmark">north.</span></header>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton-row">
        <div className="skeleton skeleton-tile" />
        <div className="skeleton skeleton-tile" />
      </div>
      <div className="skeleton skeleton-card" />
    </main>
    <BottomNav active={active} />
  </>;
}
