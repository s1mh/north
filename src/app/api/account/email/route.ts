import { NextResponse } from "next/server";
import { emailChangeSchema } from "@/features/profile/credentials";
import { sessionSatisfiesMfa } from "@/server/auth/mfa";
import { createClient } from "@/server/supabase/client";
import { verifyCurrentPassword } from "@/server/supabase/verify-password";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return fail("Origem inválida.", 403);

  const parsed = emailChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Confira os campos.", 400);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return fail("Não foi possível confirmar sua conta.", 401);

  if (!(await sessionSatisfiesMfa(supabase))) {
    return fail("Confirme a verificação em duas etapas para continuar.", 403);
  }

  if (parsed.data.email === user.email.toLowerCase()) {
    return fail("Esse já é o e-mail da sua conta.", 400);
  }

  if (!(await verifyCurrentPassword(user.email, parsed.data.currentPassword))) {
    return fail("A senha atual não confere.", 401);
  }

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${origin}/auth/callback?next=/perfil` },
  );
  if (error) {
    return fail(
      error.status === 429
        ? "Muitos pedidos. Tente de novo mais tarde."
        : "Não foi possível pedir a troca de e-mail agora.",
      error.status === 429 ? 429 : 500,
    );
  }

  return NextResponse.json({ requested: true }, { headers: privateHeaders });
}
