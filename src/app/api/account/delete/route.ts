import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accountDeletionSchema } from "@/features/profile/account";
import { createAccountAdminClient } from "@/server/supabase/admin";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Origem inválida." },
      { status: 403, headers: privateHeaders },
    );
  }

  const parsed = accountDeletionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confira a confirmação e a senha." },
      { status: 400, headers: privateHeaders },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json(
      { error: "Não foi possível confirmar sua conta." },
      { status: 401, headers: privateHeaders },
    );
  }

  const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });
  if (reauthenticationError) {
    return NextResponse.json(
      { error: "Não foi possível confirmar sua conta." },
      { status: 401, headers: privateHeaders },
    );
  }

  try {
    const admin = createAccountAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id, false);
    if (error) throw error;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível excluir sua conta agora." },
      { status: 500, headers: privateHeaders },
    );
  }

  const response = NextResponse.json(
    { deleted: true },
    { headers: privateHeaders },
  );
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name === "north-theme") {
      response.cookies.set(cookie.name, "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/",
        sameSite: "lax",
      });
    }
  }
  return response;
}
