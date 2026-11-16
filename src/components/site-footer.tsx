import Link from "next/link";
import { CONTACT_EMAIL } from "@/server/email/layout";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return <footer className="site-foot" data-compact={compact}>
    <p><b>north.</b> Comece a investir sabendo o que faz.</p>
    <p>O north é uma plataforma educacional. Nada aqui é recomendação de investimento, consultoria, oferta de produto financeiro ou promessa de rentabilidade. Simulações usam premissas que você escolhe e não garantem resultado. O north não executa ordens. Uso para maiores de 18 anos.</p>
    <p>Dados de mercado exibem a fonte e a data. Quando o dado não está atualizado, a tela avisa.</p>
    <p>Dúvidas sobre os seus dados? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · <Link href="/termos">Termos</Link> · <Link href="/privacidade">Privacidade</Link> · <Link href="/simular">Simulador</Link></p>
  </footer>;
}
