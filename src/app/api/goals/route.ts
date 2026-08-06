import { NextResponse } from "next/server";
import { goalSchema } from "@/features/goals/submission";
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
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    console.warn("[api/goals] validation_failed", {
      issues: parsed.error.issues.map((issue) => ({ code: issue.code, path: issue.path })),
    });
    return NextResponse.json(
      { error: "Revise os dados da meta e tente novamente." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("create_goal_with_plan", {
    p_name: parsed.data.name,
    p_kind: parsed.data.kind,
    p_target_amount: parsed.data.targetAmount,
    p_target_date: parsed.data.targetDate,
    p_planned_monthly_amount: parsed.data.plannedMonthlyAmount,
  });
  if (error) {
    console.error("[api/goals] create_failed", { code: error.code });
    return NextResponse.json(
      { error: "Não foi possível criar a meta agora." },
      { status: 500, headers: privateHeaders },
    );
  }

  return NextResponse.json({ id: data }, { status: 201, headers: privateHeaders });
}
