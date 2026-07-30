import { NextResponse } from "next/server";
import { institutionResearchSchema } from "@/features/institutions/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
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

  const parsed = institutionResearchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe somente o nome do banco ou da corretora." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("request_institution_research", {
    p_requested_name: parsed.data.name,
  });
  if (error) {
    const limit = error.message.includes("request limit");
    const available = error.code === "23505";
    return NextResponse.json(
      {
        error: limit
          ? "Você atingiu o limite diário de pesquisas."
          : available
            ? "Essa instituição já está no catálogo."
            : "Não foi possível enviar a pesquisa agora.",
      },
      { status: limit ? 429 : 400, headers: privateHeaders },
    );
  }

  return NextResponse.json({ id: data }, { status: 201, headers: privateHeaders });
}
