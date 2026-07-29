import { NextResponse } from "next/server";
import { goalContributionSchema } from "@/features/goals/submission";
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

  const input = await request.json().catch(() => null);
  const parsed = goalContributionSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise o aporte informado e tente novamente." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: parsed.data.goalId,
    p_amount: parsed.data.amount,
    p_contributed_on: parsed.data.contributedOn,
    p_note: parsed.data.note,
  });
  if (error) {
    const unavailable = error.code === "42501";
    return NextResponse.json(
      { error: unavailable ? "Esta meta não está disponível." : "Não foi possível registrar o aporte agora." },
      { status: unavailable ? 403 : 500, headers: privateHeaders },
    );
  }

  return NextResponse.json({ id: data }, { status: 201, headers: privateHeaders });
}
