import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/features/analytics/tracked-link";
import { SiteFooter } from "@/components/site-footer";
import { PublicSimulator } from "@/features/public/public-simulator";

export const metadata: Metadata = {
  title: "Simulador de aporte mensal",
  description: "Simule quanto um aporte mensal pequeno pode virar com as premissas que você escolher. Sem cadastro.",
  alternates: { canonical: "/simular" },
};

export default function SimularPage() {
  return <div className="lp">
    <header className="lp-top"><Link className="lp-brand" href="/">north.</Link><nav aria-label="Principal"><Link href="/entrar">Entrar</Link><Link className="lp-btn lp-btn-small" href="/cadastro">Criar conta</Link></nav></header>
    <main className="lp-section sim-page">
      <p className="lp-eyebrow">Simulador, sem cadastro</p>
      <h1>Quanto um aporte pequeno pode virar?</h1>
      <p className="lp-lead">Mexa nos controles e veja a conta. As premissas são suas: o north não prevê rentabilidade.</p>
      <PublicSimulator />
      <p className="lp-note">Simulação educacional com juros compostos e aportes mensais, sem impostos e sem taxas. Não é recomendação de investimento nem promessa de resultado. Rentabilidade passada ou imaginada não garante rentabilidade futura.</p>
      <div className="lp-final lp-final-inline"><h2>Quer guardar essa simulação e acompanhar a sua carteira?</h2><TrackedLink event="cta_signup_click" where="simulador" className="lp-btn" href="/cadastro">Criar minha conta (grátis)</TrackedLink></div>
    </main>
    <SiteFooter />
  </div>;
}
