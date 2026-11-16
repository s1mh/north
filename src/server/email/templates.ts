import { renderEmail } from "./layout.ts";

const ACCOUNT_REASON = "Você recebeu esta mensagem porque uma conta foi criada ou alterada com este e-mail no north.";

/** Modelos do Supabase Auth (placeholders no formato Go template). */
export const authTemplates = {
  confirmation: {
    subject: "Confirme seu e-mail no north.",
    html: renderEmail({
      preheader: "Um clique para confirmar e continuar de onde parou.",
      accent: "#a8e2dc",
      eyebrow: "Primeiro passo",
      title: "Confirme seu e-mail.",
      blocks: [
        { kind: "p", text: "Um clique e você volta exatamente de onde parou para começar no seu ritmo." },
        { kind: "note", title: "Link pessoal e temporário", text: "Não encaminhe esta mensagem para outras pessoas." },
        { kind: "p", text: "Se você não criou uma conta no north, pode ignorar este e-mail. Nada acontece sem a sua confirmação." },
      ],
      cta: { label: "Confirmar e continuar", href: "{{ .ConfirmationURL }}" },
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  recovery: {
    subject: "Redefina sua senha no north.",
    html: renderEmail({
      preheader: "Crie uma nova senha para entrar de novo.",
      accent: "#f2c9d0",
      eyebrow: "Segurança da conta",
      title: "Vamos criar uma nova senha.",
      blocks: [
        { kind: "p", text: "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão para escolher uma nova." },
        { kind: "note", title: "Não foi você?", text: "Ignore este e-mail. A sua senha continua a mesma. Se isso se repetir, escreva para a gente." },
      ],
      cta: { label: "Escolher nova senha", href: "{{ .ConfirmationURL }}" },
      reason: "Você recebeu esta mensagem porque alguém pediu a redefinição de senha para este e-mail.",
      service: true,
    }),
  },
  email_change: {
    subject: "Confirme o novo e-mail da sua conta no north.",
    html: renderEmail({
      preheader: "Confirme para trocar o e-mail da sua conta.",
      accent: "#e9de9e",
      eyebrow: "Segurança da conta",
      title: "Confirme o novo e-mail.",
      blocks: [
        { kind: "p", text: "Você pediu para trocar o e-mail da sua conta para <strong>{{ .NewEmail }}</strong>. Confirme para concluir a troca." },
        { kind: "note", title: "Não foi você?", text: "Ignore este e-mail e, por segurança, troque a sua senha." },
      ],
      cta: { label: "Confirmar novo e-mail", href: "{{ .ConfirmationURL }}" },
      reason: "Você recebeu esta mensagem porque houve um pedido de troca de e-mail na sua conta.",
      service: true,
    }),
  },
  reauthentication: {
    subject: "Seu código de confirmação do north.",
    html: renderEmail({
      preheader: "Use este código para confirmar a ação.",
      accent: "#d9cdee",
      eyebrow: "Confirmação de segurança",
      title: "Seu código de confirmação.",
      blocks: [
        { kind: "p", text: "Digite este código no north para confirmar a ação que você iniciou:" },
        { kind: "code", value: "{{ .Token }}" },
        { kind: "note", title: "Nunca compartilhe este código", text: "Ninguém do north vai pedir esse código por mensagem ou telefone." },
      ],
      reason: "Você recebeu esta mensagem porque uma ação sensível foi iniciada na sua conta.",
      service: true,
    }),
  },

  // Avisos de segurança do Supabase (enviados quando habilitados no projeto).
  password_changed: {
    subject: "A senha da sua conta no north. foi alterada",
    html: renderEmail({
      preheader: "Se não foi você, aja agora.",
      accent: "#f2c9d0",
      eyebrow: "Aviso de segurança",
      title: "A sua senha foi alterada.",
      blocks: [
        { kind: "p", text: "A senha da sua conta no north. acabou de ser alterada." },
        { kind: "note", title: "Não foi você?", text: "Peça uma nova senha na tela de entrada (Esqueci minha senha) e escreva para a gente. Se você ativou a verificação em duas etapas, a sua conta continua protegida pelo código." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  email_changed: {
    subject: "O e-mail da sua conta no north. foi alterado",
    html: renderEmail({
      preheader: "O e-mail da sua conta mudou.",
      accent: "#e9de9e",
      eyebrow: "Aviso de segurança",
      title: "O e-mail da sua conta mudou.",
      blocks: [
        { kind: "p", text: "O e-mail da sua conta no north. foi alterado. O e-mail anterior era <strong>{{ .OldEmail }}</strong>." },
        { kind: "note", title: "Não foi você?", text: "Escreva para a gente o quanto antes e, se ainda tiver acesso, troque a sua senha." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  phone_changed: {
    subject: "O telefone da sua conta no north. foi alterado",
    html: renderEmail({
      preheader: "O telefone da sua conta mudou.",
      accent: "#e9de9e",
      eyebrow: "Aviso de segurança",
      title: "O telefone da sua conta mudou.",
      blocks: [
        { kind: "p", text: "O telefone da sua conta no north. foi alterado. O número anterior era <strong>{{ .OldPhone }}</strong>." },
        { kind: "note", title: "Não foi você?", text: "Escreva para a gente o quanto antes e troque a sua senha." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  mfa_factor_enrolled: {
    subject: "Verificação em duas etapas ativada no north.",
    html: renderEmail({
      preheader: "Um novo método de verificação foi adicionado.",
      accent: "#cde5c4",
      eyebrow: "Aviso de segurança",
      title: "Verificação em duas etapas ativada.",
      blocks: [
        { kind: "p", text: "Um método de verificação (<strong>{{ .FactorType }}</strong>) foi adicionado à sua conta. A partir de agora, ao entrar, o north. pede o segundo código." },
        { kind: "note", title: "Não foi você?", text: "Troque a sua senha agora e escreva para a gente." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  mfa_factor_unenrolled: {
    subject: "Verificação em duas etapas desativada no north.",
    html: renderEmail({
      preheader: "Um método de verificação foi removido.",
      accent: "#f2d3b6",
      eyebrow: "Aviso de segurança",
      title: "Verificação em duas etapas desativada.",
      blocks: [
        { kind: "p", text: "Um método de verificação (<strong>{{ .FactorType }}</strong>) foi removido da sua conta. Ela agora depende só da senha, a menos que você tenha outro método ativo." },
        { kind: "note", title: "Não foi você?", text: "Troque a sua senha agora, ative a verificação de novo no Perfil e escreva para a gente." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  identity_linked: {
    subject: "Um novo método de entrada foi vinculado à sua conta no north.",
    html: renderEmail({
      preheader: "Um novo método de entrada foi vinculado.",
      accent: "#c9d8ee",
      eyebrow: "Aviso de segurança",
      title: "Um novo método de entrada foi vinculado.",
      blocks: [
        { kind: "p", text: "O método de entrada <strong>{{ .Provider }}</strong> foi vinculado à sua conta no north." },
        { kind: "note", title: "Não foi você?", text: "Troque a sua senha e escreva para a gente o quanto antes." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
  identity_unlinked: {
    subject: "Um método de entrada foi removido da sua conta no north.",
    html: renderEmail({
      preheader: "Um método de entrada foi removido.",
      accent: "#c9d8ee",
      eyebrow: "Aviso de segurança",
      title: "Um método de entrada foi removido.",
      blocks: [
        { kind: "p", text: "O método de entrada <strong>{{ .Provider }}</strong> foi removido da sua conta no north." },
        { kind: "note", title: "Não foi você?", text: "Troque a sua senha e escreva para a gente o quanto antes." },
      ],
      reason: ACCOUNT_REASON,
      service: true,
    }),
  },
} as const;

/** E-mails enviados pelo app via Resend. */
export function renderWelcome(homeUrl: string) {
  return renderEmail({
    preheader: "Seu espaço no north está pronto. Comece no seu ritmo.",
    accent: "#d9cdee",
    eyebrow: "Bem-vindo ao north.",
    title: "Comece a investir sabendo o que faz.",
    blocks: [
      { kind: "p", text: "Seu espaço está pronto. Não precisa fazer tudo hoje: entre, olhe com calma e use o que fizer sentido." },
      {
        kind: "list",
        items: [
          { title: "Entenda sem jargão", text: "Cada termo vem explicado onde aparece.", color: "#c9d8ee" },
          { title: "Veja sua carteira num lugar só", text: "Cadastre o que você já tem e acompanhe a distribuição.", color: "#cde5c4" },
          { title: "Planeje com a sua conta", text: "Defina uma meta e escolha as premissas da simulação.", color: "#d9cdee" },
        ],
      },
    ],
    cta: { label: "Abrir meu north.", href: homeUrl },
    reason: "Você recebeu esta mensagem porque criou uma conta no north.",
    service: true,
  });
}

export function renderAccountDeleted() {
  return renderEmail({
    preheader: "Sua conta e os seus dados foram apagados.",
    accent: "#e3e1da",
    eyebrow: "Conta encerrada",
    title: "Sua conta foi apagada.",
    blocks: [
      { kind: "p", text: "Apagamos a sua conta e os dados que você cadastrou, como pedido. Esta é a nossa última mensagem automática para este e-mail." },
      { kind: "p", text: "Se foi engano, você pode criar uma conta nova quando quiser. Os dados apagados não podem ser recuperados." },
      { kind: "note", title: "Não foi você?", text: "Escreva para a gente o quanto antes." },
    ],
    cta: { label: "Conhecer o north. de novo", href: "https://usenorthapp.com.br" },
    reason: "Você recebeu esta mensagem porque a conta ligada a este e-mail foi apagada.",
    service: true,
  });
}

/** Alerta interno para quem opera o produto (não vai para usuários). */
export function renderOpsAlert(input: { source: string; reason: string; since: string; adminUrl: string }) {
  const clean = (value: string) => value.replace(/[<>&]/g, "");
  return renderEmail({
    preheader: `Coleta de ${clean(input.source)} com falha.`,
    accent: "#f2d3b6",
    eyebrow: "Alerta de operação",
    title: `A coleta de ${clean(input.source)} falhou.`,
    blocks: [
      { kind: "p", text: `Motivo registrado: <strong>${clean(input.reason)}</strong>. Primeira falha seguida: ${clean(input.since)}.` },
      { kind: "note", title: "O que isso significa", text: "Os usuários estão vendo dados de mercado desatualizados, com a data de cada dado na tela." },
    ],
    cta: { label: "Ver execuções", href: input.adminUrl },
    reason: "Você recebeu esta mensagem porque é responsável pela operação do north.",
  });
}

/** Código de 6 números para a verificação em duas etapas por e-mail. */
export function renderLoginCode(code: string, purpose: "login" | "enable") {
  const enabling = purpose === "enable";
  return renderEmail({
    preheader: `Seu código: ${code}. Vale por 10 minutos.`,
    accent: "#a8e2dc",
    eyebrow: enabling ? "Verificação em duas etapas" : "Código de acesso",
    title: enabling ? "Confirme para ativar." : "Seu código de acesso.",
    blocks: [
      { kind: "p", text: enabling
        ? "Digite este código no north. para ligar a verificação em duas etapas por e-mail. Ele vale por 10 minutos."
        : "Digite este código no north. para terminar de entrar. Ele vale por 10 minutos e só funciona uma vez." },
      { kind: "code", value: code },
      { kind: "note", title: "Não foi você?", text: "Ignore este e-mail e troque a sua senha. Ninguém do north. vai pedir esse código por mensagem ou telefone." },
    ],
    reason: "Você recebeu esta mensagem porque alguém tentou entrar na sua conta ou ativar a verificação em duas etapas.",
    service: true,
  });
}
