import { NextResponse } from "next/server";
import { institutionSelectionSchema } from "@/features/institutions/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function PUT(request: Request) {
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

  const parsed = institutionSelectionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Selecione entre 1 e 10 instituições." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { error } = await supabase.rpc("sync_user_institutions", {
    p_institution_ids: parsed.data.institutionIds,
  });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível salvar seus bancos agora." },
      { status: 400, headers: privateHeaders },
    );
  }

  return NextResponse.json({ saved: true }, { headers: privateHeaders });
}
