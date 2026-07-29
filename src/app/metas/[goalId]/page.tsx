import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalContributionForm } from "@/features/goals/contribution-form";
import {
  deriveGoalProgress,
  getActiveContributionPlan,
  goalMoneyToCents,
} from "@/features/goals/calculation";
import { formatMoneyFromCents } from "@/features/portfolio/ledger";
import { createClient } from "@/server/supabase/client";

type Goal = {
  id: string;
  name: string;
  kind: string;
  target_amount: string | number;
  target_date: string;
  goal_contributions: Array<{
    id: string;
    amount: string | number;
    contributed_on: string;
    note: string | null;
  }>;
  contribution_plans:
    | { amount: string | number; status: string }
    | Array<{ amount: string | number; status: string }>
    | null;
};

const goalColors: Record<string, string> = {
  aposentadoria: "var(--cx)",
  viagem: "var(--intl)",
  imovel: "var(--ac)",
  carro: "var(--cr)",
  reserva: "var(--fu)",
  personalizada: "var(--rf)",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export const dynamic = "force-dynamic";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const { goalId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select(`
      id, name, kind, target_amount, target_date,
      goal_contributions(id, amount, contributed_on, note),
      contribution_plans(amount, status)
    `)
    .eq("id", goalId)
    .eq("status", "active")
    .order("contributed_on", { referencedTable: "goal_contributions", ascending: false })
    .single();
  if (error || !data) notFound();

  const goal = data as unknown as Goal;
  const plan = getActiveContributionPlan(goal.contribution_plans);
  const progress = deriveGoalProgress({
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
    contributions: goal.goal_contributions.map((item) => item.amount),
    plannedMonthlyAmount: plan?.amount,
  });

  return <main className="onboarding-shell">
    <div className="goal-detail">
      <div className="portfolio-form-head">
        <Link href="/metas" aria-label="Voltar para metas">←</Link>
        <div><p className="eyebrow">Sua meta</p><h1>{goal.name}</h1></div>
      </div>

      <section className="goal-progress-card" style={{ background: goalColors[goal.kind] ?? "var(--cx)" }}>
        <p className="eyebrow">Progresso registrado</p>
        <strong>{progress.percentage.toLocaleString("pt-BR")}%</strong>
        <div className="progress"><span style={{ width: `${progress.percentage}%` }} /></div>
        <div><span>{formatMoneyFromCents(progress.contributedCents)}</span><span>{formatMoneyFromCents(progress.targetCents)}</span></div>
      </section>

      <div className="goal-facts">
        <div><span>Prazo</span><strong>{formatDate(goal.target_date)}</strong></div>
        <div><span>Faltam</span><strong>{formatMoneyFromCents(progress.remainingCents)}</strong></div>
      </div>

      <section className="goal-plan-card">
        <p className="eyebrow">Plano matemático</p>
        {progress.completed ? <h2>Meta alcançada com os aportes registrados.</h2> : <>
          <h2>{formatMoneyFromCents(progress.requiredMonthlyCents)} por mês</h2>
          <p>Divisão simples do valor restante pelos {progress.monthsRemaining} meses até o prazo, sem supor rentabilidade ou inflação.</p>
          {progress.plannedMonthlyCents > 0n ? <strong>
            Seu plano atual: {formatMoneyFromCents(progress.plannedMonthlyCents)}
            {progress.monthlyGapCents > 0n
              ? ` · diferença de ${formatMoneyFromCents(progress.monthlyGapCents)}`
              : " · suficiente para a divisão atual"}
          </strong> : <strong>Nenhum aporte mensal foi planejado.</strong>}
        </>}
      </section>

      <GoalContributionForm goalId={goal.id} />

      {goal.goal_contributions.length > 0 ? <section className="goal-history">
        <p className="eyebrow">Aportes registrados</p>
        {goal.goal_contributions.map((contribution) => <article key={contribution.id}>
          <div><strong>{formatMoneyFromCents(goalMoneyToCents(contribution.amount))}</strong><span>{contribution.note ?? "Sem observação"}</span></div>
          <span>{formatDate(contribution.contributed_on)}</span>
        </article>)}
      </section> : null}
    </div>
  </main>;
}
