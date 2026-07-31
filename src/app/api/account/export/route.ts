import { NextResponse } from "next/server";
import { createClient } from "@/server/supabase/client";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sessão inválida." },
      { status: 401, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("export_current_user_data");
  if (error || !data) {
    return NextResponse.json(
      { error: "Não foi possível preparar seus dados agora." },
      { status: 500, headers: privateHeaders },
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      ...privateHeaders,
      "Content-Disposition": `attachment; filename="north-dados-${date}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
