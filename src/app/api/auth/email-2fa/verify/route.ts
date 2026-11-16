import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccountAdminClient } from "@/server/supabase/admin";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({
  purpose: z.enum(["login", "enable"]),
  code: z.string().trim().regex(/^\d{6}$/),
}).strict();

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers: privateHeaders });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400, headers: privateHeaders });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const sessionId = typeof claims?.session_id === "string" ? claims.session_id : null;
  if (!claims?.sub || !sessionId) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: privateHeaders });
  }

  const { data: valid, error } = await createAccountAdminClient().rpc("email_2fa_check", {
    p_user_id: claims.sub,
    p_session_id: sessionId,
    p_purpose: parsed.data.purpose,
    p_code: parsed.data.code,
  });
  if (error?.message === "too_many_attempts") {
    return NextResponse.json({ error: "Muitas tentativas. Peça um código novo." }, { status: 429, headers: privateHeaders });
  }
  if (error || valid !== true) {
    return NextResponse.json({ error: "Código incorreto ou expirado." }, { status: 401, headers: privateHeaders });
  }
  return NextResponse.json({ verified: true }, { headers: privateHeaders });
}
