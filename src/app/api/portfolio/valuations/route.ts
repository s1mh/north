import { NextResponse } from "next/server";
import { valuationSchema } from "@/features/portfolio/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Origem inválida.", 403);
  const parsed = valuationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Revise o valor e a data.", 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Sessão inválida.", 401);

  const { data, error } = await supabase.rpc("record_instrument_valuation", {
    p_instrument_id: parsed.data.instrumentId,
    p_total_value: parsed.data.totalValue,
    p_valued_on: parsed.data.valuedOn,
  });
  if (error) {
    if (error.code === "42501") return fail("Esse ativo não está disponível.", 403);
    if (error.code === "22003") return fail("Esse ativo não tem posição para valorizar.", 409);
    if (error.message.includes("before first trade")) return fail("A data é anterior ao primeiro lançamento.", 400);
    return fail("Não foi possível atualizar o valor agora.", 500);
  }
  return NextResponse.json(data, { headers: privateHeaders });
}
