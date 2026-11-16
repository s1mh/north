import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/server/email/send";
import { renderLoginCode } from "@/server/email/templates";
import { getPrivateEnv } from "@/server/env/private";
import { createAccountAdminClient } from "@/server/supabase/admin";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({ purpose: z.enum(["login", "enable"]) }).strict();

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers: privateHeaders });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: privateHeaders });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const sessionId = typeof claims?.session_id === "string" ? claims.session_id : null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!claims?.sub || !sessionId || !email) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: privateHeaders });
  }

  const { data: statusData } = await supabase.rpc("second_factor_status");
  const status = statusData as { method?: string | null; satisfied?: boolean } | null;
  const allowed = parsed.data.purpose === "login"
    ? status?.method === "email" && status.satisfied === false
    : !status?.method;
  if (!allowed) {
    return NextResponse.json({ error: "Pedido não permitido agora." }, { status: 409, headers: privateHeaders });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data: challengeId, error } = await createAccountAdminClient().rpc("email_2fa_issue", {
    p_user_id: claims.sub,
    p_session_id: sessionId,
    p_purpose: parsed.data.purpose,
    p_code: code,
  });
  if (error?.message === "too_many_requests") {
    return NextResponse.json({ error: "Muitos pedidos. Tente de novo em 1 hora." }, { status: 429, headers: privateHeaders });
  }
  if (error) {
    return NextResponse.json({ error: "Não foi possível enviar o código agora." }, { status: 500, headers: privateHeaders });
  }

  // Já existe um código válido enviado há menos de 60 segundos: não manda outro.
  if (challengeId === null) {
    return NextResponse.json({ sent: true, recent: true }, { headers: privateHeaders });
  }

  const apiKey = getPrivateEnv().RESEND_API_KEY;
  const delivery = await sendEmail({
    apiKey,
    to: email,
    subject: parsed.data.purpose === "enable" ? "Confirme a verificação em duas etapas no north." : "Seu código de acesso do north.",
    html: renderLoginCode(code, parsed.data.purpose),
    idempotencyKey: `north-2fa-${claims.sub}-${sessionId}-${Date.now()}`,
  });
  if (delivery === "skipped" && process.env.NODE_ENV !== "production") {
    console.info(`[north-dev] código de verificação em duas etapas: ${code}`);
  } else if (delivery !== "sent") {
    return NextResponse.json({ error: "Não foi possível enviar o código agora." }, { status: 502, headers: privateHeaders });
  }
  return NextResponse.json({ sent: true }, { headers: privateHeaders });
}
