import { AppShell } from "./app-shell";

export function EmptyFeature({ active, eyebrow, title, body, action }: { active: string; eyebrow: string; title: string; body: string; action: string }) {
  return <AppShell active={active}><p className="eyebrow">{eyebrow}</p><h1 className="display">{title}</h1><section className="section empty-card"><h2>Pronto para começar</h2><p>{body}</p><button className="button" type="button">{action}</button></section><p className="status-note">Esta fundação prepara a jornada e os estados vazios. A persistência será conectada ao Supabase no próximo marco.</p></AppShell>;
}
