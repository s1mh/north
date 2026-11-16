import { NextResponse } from "next/server";
import { passwordChangeSchema } from "@/features/profile/credentials";
import { sessionSatisfiesMfa } from "@/server/auth/mfa";
import { createClient } from "@/server/supabase/client";
import { verifyCurrentPassword } from "@/server/supabase/verify-password";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return fail("Origem inválida.", 403);
  }

  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Confira os campos.", 400);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return fail("Não foi possível confirmar sua conta.", 401);

  if (!(await sessionSatisfiesMfa(supabase))) {
    return fail("Confirme a verificação em duas etapas para continuar.", 403);
  }

  if (!(await verifyCurrentPassword(user.email, parsed.data.currentPassword))) {
    return fail("A senha atual não confere.", 401);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("Não foi possível alterar a senha agora.", 500);

  // Encerra as outras sessões: quem tinha a senha antiga perde o acesso.
  await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);

  return NextResponse.json({ changed: true }, { headers: privateHeaders });
}
