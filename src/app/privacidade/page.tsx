import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CookiePreferencesButton } from "@/features/analytics/analytics-root";
import { CONTACT_EMAIL } from "@/server/email/layout";

export const metadata: Metadata = { title: "Política de Privacidade", alternates: { canonical: "/privacidade" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <h2>Quem cuida dos seus dados</h2>
      <p>O north. é mantido por Samuel Henrique de Almeida Rocha. Para qualquer assunto sobre dados, escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      <h2>Que dados tratamos</h2>
      <p>Dados de conta (nome, e-mail e senha protegida), perfil de investidor, instituições que você informa, carteira, movimentações e metas que você cadastra, simulações salvas e as perguntas que você faz ao assistente. Não pedimos a senha do seu banco e não acessamos a sua conta bancária.</p>
      <h2>Para que usamos</h2>
      <p>Para autenticação e segurança, para oferecer as funções do aplicativo, para enviar e-mails de serviço (confirmação, segurança e boas-vindas) e para melhorar o produto. Não vendemos os seus dados e não usamos valores financeiros em publicidade.</p>
      <h2>Assistente com inteligência artificial</h2>
      <p>Para responder, o assistente usa serviços de inteligência artificial de provedores que operam fora do Brasil. Enviamos somente o necessário para a resposta (os dados financeiros cadastrados e a sua pergunta), sem o seu nome nem o seu e-mail, e pedimos que os provedores não usem esses dados para treinar modelos. Isso é uma transferência internacional de dados.</p>
      <h2>Medição de uso e cookies</h2>
      <p>Se você aceitar, usamos o Google Analytics e o Google Tag Manager para entender quais telas ajudam e quais confundem. A medição só começa depois do seu aceite. Não enviamos valores, nomes de bancos, ativos, metas, e-mail ou textos que você digita. Sem o aceite, nenhum script de medição é carregado. Você pode mudar a escolha quando quiser: <CookiePreferencesButton />.</p>
      <h2>Onde ficam os dados</h2>
      <p>Os dados da conta ficam em banco de dados hospedado no Brasil (São Paulo). E-mails e hospedagem usam provedores que podem tratar dados fora do país, com as proteções contratuais desses provedores.</p>
      <h2>Por quanto tempo</h2>
      <p>Guardamos os dados enquanto a sua conta existir. Ao apagar a conta, os seus dados são apagados, exceto o que a lei exigir guardar.</p>
      <h2>Seus direitos</h2>
      <p>Você pode acessar, corrigir, exportar e apagar os seus dados no próprio aplicativo (tela Perfil) ou pedindo por e-mail. Você também pode pedir informações sobre o tratamento e revogar o consentimento de medição a qualquer momento.</p>
      <h2>Segurança e incidentes</h2>
      <p>Usamos conexão protegida, controle de acesso por conta, verificação em duas etapas opcional (com códigos de recuperação guardados somente como hash) e boas práticas de segurança. Se houver um incidente que possa causar risco ou dano relevante, comunicaremos você e a autoridade competente, conforme a lei.</p>
      <h2>Menores de idade</h2>
      <p>O north. é para maiores de 18 anos e não é direcionado a crianças ou adolescentes.</p>
    </LegalPage>
  );
}
