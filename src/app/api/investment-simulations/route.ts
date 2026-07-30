import { NextResponse } from "next/server";
import { deriveProjection } from "@/features/investment/calculation";
import { investmentSimulationSchema } from "@/features/investment/submission";
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
  const parsed = investmentSimulationSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise o valor, a distribuição e as premissas." },
      { status: 400, headers: privateHeaders },
    );
  }

  try {
    deriveProjection(parsed.data);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível calcular esse cenário com segurança." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("save_investment_simulation", {
    p_mode: parsed.data.mode,
    p_goal_id: parsed.data.goalId,
    p_frequency: parsed.data.frequency,
    p_contribution_amount: parsed.data.contributionAmount,
    p_horizon_months: parsed.data.horizonMonths,
    p_annual_return_rate: parsed.data.annualReturnRate,
    p_annual_inflation_rate: parsed.data.annualInflationRate,
    p_annual_fee_rate: parsed.data.annualFeeRate,
    p_allocation: parsed.data.allocation,
  });
  if (error) {
    const unavailableGoal = error.code === "42501";
    return NextResponse.json(
      { error: unavailableGoal ? "Essa meta não está disponível." : "Não foi possível salvar a simulação agora." },
      { status: unavailableGoal ? 404 : 500, headers: privateHeaders },
    );
  }

  return NextResponse.json({ id: data }, { status: 201, headers: privateHeaders });
}
