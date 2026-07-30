import { NextResponse } from "next/server";
import { themePreferenceSchema } from "@/features/profile/theme";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Origem inválida." },
      { status: 403, headers: privateHeaders },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sessão inválida." },
      { status: 401, headers: privateHeaders },
    );
  }

  const parsed = themePreferenceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tema inválido." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { error } = await supabase.rpc("set_theme_preference", {
    p_theme: parsed.data.theme,
  });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível salvar o tema." },
      { status: 500, headers: privateHeaders },
    );
  }

  const response = NextResponse.json(
    { theme: parsed.data.theme },
    { headers: privateHeaders },
  );
  response.cookies.set("north-theme", parsed.data.theme, {
    httpOnly: false,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
