import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const allocation = [{ label:"Renda fixa", value:"42%", color:"var(--rf)", width:42 },{ label:"Ações", value:"24%", color:"var(--ac)", width:24 },{ label:"Fundos", value:"19%", color:"var(--fu)", width:19 },{ label:"Cripto", value:"15%", color:"var(--cr)", width:15 }];
const shortcuts = [['✦', 'Assistente', '/assistente'], ['↗', 'Investir', '/investir'], ['◎', 'Metas', '/metas'], ['◇', 'Produtos', '/produtos']] as const;

export default function Home() {
  return <AppShell active="/inicio">
    <p className="eyebrow">Seu patrimônio</p>
    <div className="balance-row"><h1 className="display">R$ 84.620</h1><span className="change">↑ 1,8% no mês</span></div>
    <div className="distribution" aria-label="Distribuição da carteira">{allocation.map(item => <span key={item.label} style={{background:item.color, width:`${item.width}%`}} />)}</div>
    <div className="legend">{allocation.map(item => <div key={item.label}><span className="dot" style={{background:item.color}} />{item.label} <b>{item.value}</b></div>)}</div>

    <section className="section"><p className="eyebrow">Continue sua jornada</p><div className="shortcuts">
      {shortcuts.map(([icon,label,href]) => <Link className="shortcut" href={href} key={label}><span className="shortcut-icon">{icon}</span>{label}</Link>)}
    </div></section>

    <section className="section"><div className="section-head"><div><p className="eyebrow">North observa</p><h2>Sugestões pra você</h2></div><Link href="/assistente">Ver todas</Link></div>
      <article className="editorial"><p className="eyebrow">Equilíbrio da carteira</p><h3>Sua renda variável passou um pouco do alvo.</h3><p>Antes do próximo aporte, vale entender como a distribuição atual conversa com seu perfil moderado.</p><footer><span>Sugestão educacional</span><Link href="/assistente">Entender →</Link></footer></article>
    </section>

    <section className="section"><div className="section-head"><div><p className="eyebrow">Sua prioridade</p><h2>Reserva tranquila</h2></div><Link href="/metas">Detalhes</Link></div>
      <div className="goal"><p className="eyebrow">Meta para dez/2026</p><strong>R$ 18.900 de R$ 30.000</strong><div className="progress"><span /></div><div className="goal-meta"><span>63% concluída</span><span>Faltam R$ 11.100</span></div></div>
    </section>
    <p className="status-note">Dados ilustrativos para validar a experiência. Nenhuma ordem é executada pelo North. Cotações reais sempre exibirão fonte e horário de atualização.</p>
  </AppShell>;
}
