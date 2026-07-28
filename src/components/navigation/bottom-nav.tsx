import Link from "next/link";

const items = [["/", "Início"], ["/investir", "Investir"], ["/carteira", "Carteira"], ["/mercado", "Mercado"]] as const;

export function BottomNav({ active }: { active: string }) {
  return <nav className="nav" aria-label="Navegação principal">{items.map(([href, label]) => <Link key={href} href={href} data-active={active === href} aria-current={active === href ? "page" : undefined}>{label}</Link>)}</nav>;
}
