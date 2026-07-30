import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Origem inválida." },
      { status: 403, headers: privateHeaders },
    );
  }
  const parsedId = z.uuid().safeParse((await params).threadId);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Conversa inválida." },
      { status: 400, headers: privateHeaders },
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

  const { error } = await supabase.rpc("delete_assistant_thread", {
    p_thread_id: parsedId.data,
  });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível apagar essa conversa." },
      { status: error.code === "42501" ? 404 : 500, headers: privateHeaders },
    );
  }
  return new NextResponse(null, { status: 204, headers: privateHeaders });
}
