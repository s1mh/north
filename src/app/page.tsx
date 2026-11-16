import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/features/analytics/tracked-link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { absolute: "north. Comece a investir sabendo o que faz" },
  alternates: { canonical: "/" },
};

const pillars = [
  ["Entenda sem jargão", "Cada termo vem explicado no lugar onde aparece. Dá para aprender no seu ritmo, sem pressa e sem vergonha de perguntar."],
  ["Veja sua carteira num lugar só", "Cadastre o que você já tem e acompanhe como o seu dinheiro está distribuído entre as classes de ativos."],
  ["Planeje com a sua conta", "Defina uma meta, escolha as premissas e veja o que muda. Nenhum número que você não possa conferir."],
] as const;

const trust = [
  ["Todo número tem fonte e data", "Quando a gente não tem o dado, a tela diz que não tem. Nada de estimativa inventada."],
  ["Não pedimos a senha do seu banco", "Você cadastra à mão o que quiser. Nada é conectado sem você saber."],
  ["Seus dados são seus", "Você pode exportar ou apagar a sua conta quando quiser."],
  ["O north não executa ordens", "Não é corretora. Não diz para comprar ou vender nada: é educação e acompanhamento."],
] as const;

const faqs = [
  ["O north é gratuito?", "Sim, para aprender e acompanhar a sua carteira. Se um dia existir um plano pago com recursos extras, o preço vai estar claro antes de qualquer cobrança."],
  ["O north me diz onde investir?", "Não. Ele explica conceitos, mostra dados oficiais com fonte e data e deixa você simular com as suas próprias premissas. As decisões são suas."],
  ["Preciso conectar minha conta de banco?", "Não. Você cadastra os ativos manualmente, no seu ritmo."],
  ["Para quem é?", "Para quem está começando, tem uma sobra pequena por mês e quer entender antes de decidir. O uso é para maiores de 18 anos."],
] as const;

export default function WelcomePage() {
  return (
    <div className="lp">
      <header className="lp-top">
        <Link className="lp-brand" href="/">north.</Link>
        <nav aria-label="Principal">
          <Link href="/simular">Simulador</Link>
          <Link href="/entrar">Entrar</Link>
          <TrackedLink event="cta_signup_click" where="topo" className="lp-btn lp-btn-small" href="/cadastro">Criar conta</TrackedLink>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Educação financeira, no seu ritmo</p>
            <h1 className="lp-h1"><span>Comece a</span> <span>investir</span> <span>sabendo o</span> <span>que faz.</span></h1>
            <p className="lp-lead">Para quem está começando: entenda Tesouro, CDB e ação, simule um aporte pequeno e acompanhe a sua carteira, no seu ritmo.</p>
            <div className="lp-actions">
              <TrackedLink event="cta_signup_click" where="hero" className="lp-btn" href="/cadastro">Criar minha conta (grátis)</TrackedLink>
              <Link className="lp-btn lp-btn-ghost" href="/simular">Simular um aporte</Link>
            </div>
            <p className="lp-note">Educacional. O north não executa ordens e não recomenda ativos.</p>
          </div>
          <div className="lp-hero-art" aria-hidden="true">
            <div className="lp-card lp-card-main">
              <small>Seu patrimônio</small>
              <strong>R$ 12.480,00</strong>
              <div className="lp-bar"><i style={{ "--w": "62%", background: "var(--rf)" } as React.CSSProperties} /><i style={{ "--w": "18%", background: "var(--ac)" } as React.CSSProperties} /><i style={{ "--w": "12%", background: "var(--fi)" } as React.CSSProperties} /><i style={{ "--w": "8%", background: "var(--cr)" } as React.CSSProperties} /></div>
              <ul><li><b style={{ background: "var(--rf)" }} />Renda fixa 62%</li><li><b style={{ background: "var(--ac)" }} />Ações 18%</li><li><b style={{ background: "var(--fi)" }} />FIIs 12%</li><li><b style={{ background: "var(--cr)" }} />Outros 8%</li></ul>
            </div>
            <div className="lp-card lp-card-goal">
              <small>Meta: reserva de emergência</small>
              <strong>R$ 3.000 de R$ 10.000</strong>
              <div className="lp-track"><i style={{ "--w": "30%" } as React.CSSProperties} /></div>
              <span>Exemplo ilustrativo</span>
            </div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-o-que">
          <h2 id="lp-o-que">O que dá para fazer no north</h2>
          <div className="lp-grid3">
            {pillars.map(([t, d], i) => <article key={t} className="lp-tile" data-i={i}><span>{i + 1}</span><h3>{t}</h3><p>{d}</p></article>)}
          </div>
        </section>

        <section className="lp-section lp-trust" aria-labelledby="lp-confianca">
          <h2 id="lp-confianca">Como a gente cuida da sua confiança</h2>
          <div className="lp-grid2">
            {trust.map(([t, d]) => <article key={t}><h3>{t}</h3><p>{d}</p></article>)}
          </div>
          <p className="lp-never"><b>O que o north nunca faz:</b> dizer &ldquo;compre&rdquo; ou &ldquo;venda&rdquo; um ativo, prometer retorno ou pedir a senha do seu banco.</p>
        </section>

        <section className="lp-section" aria-labelledby="lp-faq">
          <h2 id="lp-faq">Perguntas frequentes</h2>
          <div className="lp-faq">
            {faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="lp-final">
          <h2>Um jeito calmo de começar.</h2>
          <TrackedLink event="cta_signup_click" where="final" className="lp-btn" href="/cadastro">Criar minha conta (grátis)</TrackedLink>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
