import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/server/email/layout";

export const metadata: Metadata = { title: "Termos de Uso", alternates: { canonical: "/termos" } };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso">
      <h2>O que o north. é</h2>
      <p>O north. é uma plataforma educacional. Explica conceitos de investimento, mostra dados públicos com fonte e data, permite simular cenários com premissas que você escolhe e ajuda você a acompanhar a carteira que você mesmo cadastra.</p>
      <h2>O que o north. não faz</h2>
      <p>O north. não é corretora, não executa ordens, não acessa sua conta bancária e não pede a senha do seu banco. Nada no aplicativo é recomendação de investimento, consultoria, gestão de carteira ou oferta de produto financeiro, e nenhum conteúdo promete rentabilidade. As decisões sobre o seu dinheiro são sempre suas.</p>
      <h2>Quem pode usar</h2>
      <p>O uso é para maiores de 18 anos. Ao criar a conta, você declara ter 18 anos ou mais.</p>
      <h2>Suas informações</h2>
      <p>Você é responsável pela exatidão dos dados que cadastra. Os dados de carteira, metas e perfil são usados para oferecer as funções descritas no aplicativo. Você pode usar valores aproximados ou fictícios.</p>
      <h2>Simulações e dados de mercado</h2>
      <p>Simulações usam premissas que você define e não garantem resultado. Dados de mercado mostram a fonte e a data. Quando um dado não está atualizado, o aplicativo avisa. Investimentos envolvem riscos e podem gerar perdas.</p>
      <h2>Assistente com inteligência artificial</h2>
      <p>O assistente responde somente com base nos dados que você cadastrou e nos dados públicos exibidos. Ele pode errar. Confira as informações importantes. Há um limite de perguntas por dia.</p>
      <h2>Teste fechado</h2>
      <p>O north. está em teste fechado. Funções podem mudar, ser removidas ou ficar indisponíveis. Se houver planos pagos no futuro, o preço e as condições serão informados com clareza antes de qualquer cobrança.</p>
      <h2>Contato</h2>
      <p>Dúvidas ou pedidos: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
