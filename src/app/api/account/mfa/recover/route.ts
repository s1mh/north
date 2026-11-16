import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccountAdminClient } from "@/server/supabase/admin";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({ code: z.string().trim().min(8).max(40) }).strict();

/**
 * Perdeu o aplicativo autenticador: um código de recuperação (uso único) desliga o segundo fator.
 * A conta continua protegida pela senha, e a pessoa é levada a ativar de novo no Perfil.
 */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers: privateHeaders });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400, headers: privateHeaders });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: privateHeaders });
  }

  const { data: valid, error } = await supabase.rpc("consume_mfa_recovery_code", { p_code: parsed.data.code });
  if (error?.message === "too_many_attempts") {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429, headers: privateHeaders });
  }
  if (error || valid !== true) {
    return NextResponse.json({ error: "Código inválido." }, { status: 401, headers: privateHeaders });
  }

  try {
    const admin = createAccountAdminClient();
    const { data: listed, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (listError) throw listError;
    for (const factor of listed?.factors ?? []) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
      if (deleteError) throw deleteError;
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível desativar agora." }, { status: 500, headers: privateHeaders });
  }
  return NextResponse.json({ recovered: true }, { headers: privateHeaders });
}
