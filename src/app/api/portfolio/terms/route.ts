import { NextResponse } from "next/server";
import { z } from "zod";
import { instrumentTermsInputSchema } from "@/features/portfolio/terms";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

const bodySchema = z.object({
  instrumentId: z.uuid(),
  terms: instrumentTermsInputSchema,
}).strict();

export async function PUT(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Origem inválida.", 403);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revise os dados da ficha.", 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Sessão inválida.", 401);

  const { data, error } = await supabase.rpc("set_instrument_terms", {
    p_instrument_id: parsed.data.instrumentId,
    p_terms: parsed.data.terms,
  });
  if (error) {
    if (error.code === "42501") return fail("Esse ativo não está disponível.", 403);
    return fail("Não foi possível salvar a ficha agora.", error.code === "23514" ? 400 : 500);
  }
  return NextResponse.json(data, { headers: privateHeaders });
}
