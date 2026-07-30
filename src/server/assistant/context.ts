import "server-only";
import { createHash } from "node:crypto";
import { deriveGoalProgress, getActiveContributionPlan } from "@/features/goals/calculation";
import { isIndicatorStale, latestIndicators, type MarketIndicatorRow } from "@/features/market/presentation";
import { derivePosition, type PortfolioTransaction } from "@/features/portfolio/ledger";
import { targetAllocationRecord } from "@/features/suitability/questionnaire";
import type { InvestorProfile } from "@/features/suitability/score";
import type { AssistantContext } from "@/features/assistant/types";
import { createClient } from "@/server/supabase/client";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type InstrumentRow = {
  asset_class: string;
  latest_price: string | number | null;
  portfolio_transactions: PortfolioTransaction[];
};

type GoalRow = {
  target_amount: string | number;
  target_date: string;
  goal_contributions: Array<{ amount: string | number }>;
  contribution_plans:
    | { amount: string | number; status: string }
    | Array<{ amount: string | number; status: string }>
    | null;
};

const classLabels: Record<string, string> = {
  renda_fixa: "Renda Fixa",
  acoes: "Ações · ETF",
  fundos: "Fundos",
  fiis: "FIIs",
  internacional: "Internacional",
  cripto: "Cripto",
  outros: "Outros",
};

const profileLabels: Record<InvestorProfile, AssistantContext["profile"]["label"]> = {
  conservador: "Conservador",
  moderado: "Moderado",
  arrojado: "Arrojado",
};

export async function loadAssistantContext(supabase: SupabaseServerClient) {
  const [profileResult, portfolioResult, goalResult, indicatorResult] = await Promise.all([
    supabase.from("profiles").select("current_assessment_id").maybeSingle(),
    supabase
      .from("portfolio_instruments")
      .select(`
        asset_class, latest_price,
        portfolio_transactions(
          id, transaction_type, quantity, unit_price, fees, cash_amount,
          reverses_transaction_id, corrects_transaction_id, audit_reason,
          trade_date, created_at
        )
      `)
      .order("trade_date", { referencedTable: "portfolio_transactions", ascending: true })
      .order("created_at", { referencedTable: "portfolio_transactions", ascending: true }),
    supabase
      .from("goals")
      .select(`
        target_amount, target_date,
        goal_contributions(amount),
        contribution_plans(amount, status)
      `)
      .eq("status", "active")
      .order("target_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("market_indicators")
      .select(`
        code, label, value, unit, observed_on, fetched_at,
        market_data_sources(display_name, attribution)
      `)
      .order("observed_on", { ascending: false })
      .limit(12),
  ]);

  const assessmentId = profileResult.data?.current_assessment_id as string | null | undefined;
  const { data: assessment } = assessmentId
    ? await supabase
      .from("suitability_assessments")
      .select("profile")
      .eq("id", assessmentId)
      .maybeSingle()
    : { data: null };
  const profile: InvestorProfile = assessment?.profile === "moderado" || assessment?.profile === "arrojado"
    ? assessment.profile
    : "conservador";

  const positions = ((portfolioResult.data ?? []) as unknown as InstrumentRow[])
    .map((instrument) => ({
      assetClass: instrument.asset_class,
      ...derivePosition(instrument.portfolio_transactions, instrument.latest_price),
    }))
    .filter((position) => position.quantity > 0n);
  const totalCents = positions.reduce(
    (total, position) => total + (position.currentValueCents ?? position.costBasisCents),
    0n,
  );
  const allocationCents = positions.reduce<Record<string, bigint>>((result, position) => {
    const label = classLabels[position.assetClass] ?? "Outros";
    result[label] = (result[label] ?? 0n) + (position.currentValueCents ?? position.costBasisCents);
    return result;
  }, {});
  const allocation = Object.fromEntries(
    Object.entries(allocationCents).map(([label, cents]) => [
      label,
      totalCents === 0n ? 0 : Number((cents * 1000n) / totalCents) / 10,
    ]),
  );

  const goal = goalResult.data as unknown as GoalRow | null;
  const plan = goal ? getActiveContributionPlan(goal.contribution_plans) : undefined;
  const goalProgress = goal ? deriveGoalProgress({
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
    contributions: goal.goal_contributions.map((item) => item.amount),
    plannedMonthlyAmount: plan?.amount,
  }) : null;

  const indicators = latestIndicators(
    (indicatorResult.data ?? []) as unknown as MarketIndicatorRow[],
  );
  const context: AssistantContext = {
    profile: {
      label: profileLabels[profile],
      targetAllocation: targetAllocationRecord(profile),
    },
    portfolio: {
      totalCents: totalCents.toString(),
      allocation,
    },
    goal: goalProgress ? {
      remainingCents: goalProgress.remainingCents.toString(),
      requiredMonthlyCents: goalProgress.requiredMonthlyCents.toString(),
      plannedMonthlyCents: goalProgress.plannedMonthlyCents.toString(),
      plannedGapCents: goalProgress.monthlyGapCents.toString(),
    } : null,
    market: indicators.map((indicator) => ({
      code: indicator.code,
      label: indicator.label,
      value: String(indicator.value),
      unit: indicator.unit,
      observedOn: indicator.observed_on,
      stale: isIndicatorStale(indicator),
      source: indicator.market_data_sources?.display_name ?? "Fonte registrada no North",
    })),
  };
  const sourceRefs = [
    "profile:current",
    ...(positions.length > 0 ? ["portfolio:derived-ledger"] : []),
    ...(goalProgress ? ["goal:active-summary"] : []),
    ...context.market.map((indicator) => `market:${indicator.code}:${indicator.observedOn}`),
  ];
  const contextHash = createHash("sha256").update(JSON.stringify(context)).digest("hex");

  return { context, sourceRefs, contextHash };
}
