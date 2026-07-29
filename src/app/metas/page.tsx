import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { deriveGoalProgress, getActiveContributionPlan } from "@/features/goals/calculation";
import { formatMoneyFromCents } from "@/features/portfolio/ledger";
import { createClient } from "@/server/supabase/client";

type Goal = {
  id: string;
  name: string;
  kind: string;
  target_amount: string | number;
  target_date: string;
  goal_contributions: Array<{ amount: string | number }>;
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

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(`
      id, name, kind, target_amount, target_date,
      goal_contributions(amount),
      contribution_plans(amount, status)
    `)
    .eq("status", "active")
    .order("target_date", { ascending: true });
  const goals = (data ?? []) as unknown as Goal[];

  return <AppShell active="">
    <div className="goals-heading">
      <div><p className="eyebrow">Planos que cabem na vida</p><h1>Metas</h1></div>
      <Link className="portfolio-add" href="/metas/nova">+ Nova</Link>
    </div>

    {goals.length > 0 ? <div className="goal-list">
      {goals.map((goal) => {
        const plan = getActiveContributionPlan(goal.contribution_plans);
        const progress = deriveGoalProgress({
          targetAmount: goal.target_amount,
          targetDate: goal.target_date,
          contributions: goal.goal_contributions.map((item) => item.amount),
          plannedMonthlyAmount: plan?.amount,
        });
        return <Link
          className="goal-list-card"
          href={`/metas/${goal.id}`}
          key={goal.id}
          style={{ background: goalColors[goal.kind] ?? "var(--cx)" }}
        >
          <header><strong>{goal.name}</strong><span>{goal.target_date.slice(0, 4)}</span></header>
          <div><strong>{formatMoneyFromCents(progress.contributedCents)}</strong><span>de {formatMoneyFromCents(progress.targetCents)}</span></div>
          <div className="progress"><span style={{ width: `${progress.percentage}%` }} /></div>
          <footer>
            <span>{progress.percentage.toLocaleString("pt-BR")}% concluída</span>
            <span>{progress.completed ? "meta alcançada" : `faltam ${formatMoneyFromCents(progress.remainingCents)}`}</span>
          </footer>
        </Link>;
      })}
    </div> : <section className="section empty-card">
      <h2>Transforme uma intenção em plano</h2>
      <p>Crie uma meta com valor, prazo e aporte mensal. O progresso começa vazio e cresce apenas com os valores registrados por você.</p>
      <Link className="button" href="/metas/nova">Criar primeira meta</Link>
    </section>}

    <p className="status-note">Metas e aportes são registros de planejamento. O North não movimenta dinheiro nem promete rentabilidade.</p>
  </AppShell>;
}
