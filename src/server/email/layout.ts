// Layout único dos e-mails do north. Sem dependências, para poder rodar também em scripts.
// Mantém tabelas e estilos inline por compatibilidade com clientes de e-mail.

export const CONTACT_EMAIL = "contato@usenorthapp.com.br";
export const SITE_URL = "https://usenorthapp.com.br";

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "note"; title: string; text: string }
  | { kind: "code"; value: string }
  | { kind: "list"; items: Array<{ title: string; text: string; color: string }> };

export type EmailSpec = {
  preheader: string;
  accent: string;
  eyebrow: string;
  title: string;
  blocks: EmailBlock[];
  cta?: { label: string; href: string };
  /** Por que a pessoa recebeu este e-mail. */
  reason: string;
  /** Se for e-mail de serviço, explica que não há descadastro. */
  service?: boolean;
};

const INK = "#12110e";
const MUTED = "#6b6659";
const FAINT = "#8a8478";
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function block(item: EmailBlock) {
  if (item.kind === "p") {
    return `<p style="margin:0 0 20px;color:${MUTED};font-size:16px;line-height:1.6;">${item.text}</p>`;
  }
  if (item.kind === "note") {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 22px;border:2px solid ${INK};border-radius:10px;"><tr><td style="padding:14px 16px;"><strong style="font-size:14px;">${item.title}</strong><br><span style="color:${MUTED};font-size:13px;line-height:1.55;">${item.text}</span></td></tr></table>`;
  }
  if (item.kind === "code") {
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;"><tr><td style="padding:16px 26px;border-radius:12px;background:${INK};color:#f5f4ef;font-size:32px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${item.value}</td></tr></table>`;
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">${item.items
    .map((entry) => `<tr><td style="padding:14px 16px;border-radius:12px;background:${entry.color};"><strong style="font-size:14px;">${entry.title}</strong><br><span style="color:#3d3a33;font-size:13px;line-height:1.5;">${entry.text}</span></td></tr><tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>`)
    .join("")}</table>`;
}

export function renderEmail(spec: EmailSpec) {
  const serviceLine = spec.service
    ? " É um e-mail de serviço, por isso não tem opção de cancelar o envio."
    : "";
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">
    <title>${esc(spec.title)}</title>
  </head>
  <body style="margin:0;background:#efede7;color:${INK};font-family:${FONT};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${spec.preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#efede7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#f8f6f0;border:1px solid #e3e1da;border-radius:22px;overflow:hidden;">
          <tr><td height="8" style="height:8px;background:${spec.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:28px 32px 6px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="font-size:28px;font-weight:800;letter-spacing:-1.6px;">north.</td>
              <td align="right"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td width="10" height="10" style="border-radius:50%;background:#f2c9d0;font-size:0;">&nbsp;</td><td width="4"></td>
                <td width="10" height="10" style="border-radius:50%;background:#e9de9e;font-size:0;">&nbsp;</td><td width="4"></td>
                <td width="10" height="10" style="border-radius:50%;background:#a8e2dc;font-size:0;">&nbsp;</td><td width="4"></td>
                <td width="10" height="10" style="border-radius:50%;background:#d9cdee;font-size:0;">&nbsp;</td>
              </tr></table></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:22px 32px 34px;">
            <p style="margin:0 0 10px;color:${MUTED};font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${spec.eyebrow}</p>
            <h1 style="margin:0 0 18px;font-size:34px;line-height:1.05;letter-spacing:-1.7px;">${spec.title}</h1>
            ${spec.blocks.map(block).join("\n            ")}
            ${spec.cta ? `<a href="${spec.cta.href}" style="display:inline-block;margin-top:4px;padding:16px 26px;border-radius:999px;background:${INK};color:#f5f4ef;font-size:15px;font-weight:800;text-decoration:none;">${spec.cta.label}</a>` : ""}
          </td></tr>
          <tr><td style="padding:22px 32px 28px;border-top:1px solid #e3e1da;color:${FAINT};font-size:12px;line-height:1.6;">
            <strong style="color:${MUTED};">north.</strong> Comece a investir sabendo o que faz.<br>
            ${spec.reason}${serviceLine}<br><br>
            <span style="color:${MUTED};">O north é educacional. Nada aqui é recomendação de investimento, consultoria, oferta de produto financeiro ou promessa de rentabilidade. Uso para maiores de 18 anos.</span><br><br>
            Dúvidas sobre os seus dados? Escreva para <a href="mailto:${CONTACT_EMAIL}" style="color:${MUTED};">${CONTACT_EMAIL}</a>.<br>
            <a href="${SITE_URL}/termos" style="color:${MUTED};">Termos</a> · <a href="${SITE_URL}/privacidade" style="color:${MUTED};">Privacidade</a> · <a href="${SITE_URL}" style="color:${MUTED};">usenorthapp.com.br</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`;
}
