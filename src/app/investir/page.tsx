import { AppShell } from "@/components/app-shell";
import { deriveGoalProgress, getActiveContributionPlan } from "@/features/goals/calculation";
import { monthsUntilDate } from "@/features/investment/calculation";
import { InvestmentSimulator } from "@/features/investment/investment-simulator";
import { todayInSaoPaulo } from "@/features/portfolio/submission";
import { targetAllocations } from "@/features/suitability/questionnaire";
import type { InvestorProfile } from "@/features/suitability/score";
import { createClient } from "@/server/supabase/client";

type GoalRow = {
  id: string;
  name: string;
  target_amount: string | number;
  target_date: string;
  goal_contributions: Array<{ amount: string | number; reversed_at: string | null }>;
  contribution_plans:
    | { amount: string | number; status: string }
    | Array<{ amount: string | number; status: string }>
    | null;
};

type SimulationRow = {
  id: string;
  mode: "free" | "goal";
  frequency: "once" | "monthly";
  contribution_amount: string | number;
  created_at: string;
  goals: { name: string } | Array<{ name: string }> | null;
};

export const dynamic = "force-dynamic";

export default async function InvestPage() {
  const supabase = await createClient();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("current_assessment_id")
    .maybeSingle();
  const assessmentId = profileRow?.current_assessment_id as string | null | undefined;

  const [assessmentResult, goalsResult, simulationsResult] = await Promise.all([
    assessmentId
      ? supabase.from("suitability_assessments").select("profile").eq("id", assessmentId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("goals")
      .select(`
        id, name, target_amount, target_date,
        goal_contributions(amount, reversed_at),
        contribution_plans(amount, status)
      `)
      .eq("status", "active")
      .order("target_date", { ascending: true }),
    supabase
      .from("investment_simulations")
      .select("id, mode, frequency, contribution_amount, created_at, goals(name)")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const profile = (
    assessmentResult.data?.profile === "moderado"
    || assessmentResult.data?.profile === "arrojado"
  ) ? assessmentResult.data.profile : "conservador";
  const allocation = Object.fromEntries(
    targetAllocations[profile as InvestorProfile].map(({ label, value }) => [label, value]),
  );
  const today = todayInSaoPaulo();
  const goals = ((goalsResult.data ?? []) as unknown as GoalRow[]).map((goal) => {
    const plan = getActiveContributionPlan(goal.contribution_plans);
    const progress = deriveGoalProgress({
      targetAmount: goal.target_amount,
      targetDate: goal.target_date,
      contributions: goal.goal_contributions
        .filter((item) => !item.reversed_at)
        .map((item) => item.amount),
      plannedMonthlyAmount: plan?.amount,
    });
    return {
      id: goal.id,
      name: goal.name,
      remainingCents: progress.remainingCents.toString(),
      horizonMonths: Math.min(600, monthsUntilDate(goal.target_date, today)),
      plannedMonthlyAmount: plan ? String(plan.amount) : null,
    };
  });
  const recent = ((simulationsResult.data ?? []) as unknown as SimulationRow[]).map((simulation) => {
    const relatedGoal = Array.isArray(simulation.goals) ? simulation.goals[0] : simulation.goals;
    return {
      id: simulation.id,
      mode: simulation.mode,
      frequency: simulation.frequency,
      contributionAmount: String(simulation.contribution_amount),
      createdAt: simulation.created_at,
      goalName: relatedGoal?.name ?? null,
    };
  });

  return <AppShell active="/investir">
    <InvestmentSimulator
      profile={profile as InvestorProfile}
      initialAllocation={allocation}
      goals={goals}
      recent={recent}
    />
  </AppShell>;
}
