import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { deriveGoalProgress, getActiveContributionPlan } from "@/features/goals/calculation";
import {
  derivePosition,
  formatMoneyFromCents,
  type PortfolioTransaction,
} from "@/features/portfolio/ledger";
import {
  formatIndicatorValue,
  formatObservedDate,
  isIndicatorStale,
  latestIndicators,
  type MarketIndicatorRow,
} from "@/features/market/presentation";
import { createClient } from "@/server/supabase/client";

type Instrument = {
  id: string;
  asset_class: string;
  latest_price: string | number | null;
  portfolio_transactions: PortfolioTransaction[];
};

type Goal = {
  id: string;
  name: string;
  target_amount: string | number;
  target_date: string;
  goal_contributions: Array<{ amount: string | number }>;
  contribution_plans:
    | { amount: string | number; status: string }
    | Array<{ amount: string | number; status: string }>
    | null;
};

const classes: Record<string, { label: string; color: string }> = {
  renda_fixa: { label: "Renda fixa", color: "var(--rf)" },
  acoes: { label: "Ações B3", color: "var(--ac)" },
  fundos: { label: "Fundos", color: "var(--fu)" },
  fiis: { label: "FIIs", color: "var(--fi)" },
  internacional: { label: "Internacional", color: "var(--intl)" },
  cripto: { label: "Cripto", color: "var(--cr)" },
  outros: { label: "Outros", color: "var(--cx)" },
};
const shortcuts = [
  ["✦", "Assistente", "/assistente"],
  ["↗", "Investir", "/investir"],
  ["◎", "Metas", "/metas"],
  ["◇", "Produtos", "/produtos"],
] as const;

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const [portfolioResult, indicatorResult, goalResult] = await Promise.all([
    supabase
      .from("portfolio_instruments")
      .select(`
        id, asset_class, latest_price,
        portfolio_transactions(
          id, transaction_type, quantity, unit_price, fees, cash_amount,
          reverses_transaction_id, corrects_transaction_id, audit_reason,
          trade_date, created_at
        )
      `)
      .order("trade_date", { referencedTable: "portfolio_transactions", ascending: true })
      .order("created_at", { referencedTable: "portfolio_transactions", ascending: true }),
    supabase
      .from("market_indicators")
      .select(`
        code, label, value, unit, observed_on, fetched_at,
        market_data_sources(display_name, attribution)
      `)
      .order("observed_on", { ascending: false })
      .limit(12),
    supabase
      .from("goals")
      .select(`
        id, name, target_amount, target_date,
        goal_contributions(amount),
        contribution_plans(amount, status)
      `)
      .eq("status", "active")
      .order("target_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const positions = ((portfolioResult.data ?? []) as unknown as Instrument[])
    .map((instrument) => ({
      instrument,
      ...derivePosition(instrument.portfolio_transactions, instrument.latest_price),
    }))
    .filter((position) => position.quantity > 0n);
  const totalCents = positions.reduce(
    (total, position) => total + (position.currentValueCents ?? position.costBasisCents),
    0n,
  );
  const allocation = Object.entries(positions.reduce<Record<string, bigint>>((result, position) => {
    result[position.instrument.asset_class] = (result[position.instrument.asset_class] ?? 0n)
      + (position.currentValueCents ?? position.costBasisCents);
    return result;
  }, {})).map(([assetClass, value]) => ({
    label: classes[assetClass]?.label ?? "Outros",
    color: classes[assetClass]?.color ?? "var(--cx)",
    percentage: totalCents === 0n ? 0 : Number((value * 1000n) / totalCents) / 10,
  }));
  const indicators = latestIndicators(
    (indicatorResult.data ?? []) as unknown as MarketIndicatorRow[],
  );
  const goal = goalResult.data as Goal | null;
  const goalPlan = goal ? getActiveContributionPlan(goal.contribution_plans) : undefined;
  const goalProgress = goal ? deriveGoalProgress({
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
    contributions: goal.goal_contributions.map((item) => item.amount),
    plannedMonthlyAmount: goalPlan?.amount,
  }) : null;
  const goalNeedsPace = Boolean(goalProgress && goalProgress.monthlyGapCents > 0n);

  return <AppShell active="/inicio">
    <p className="eyebrow">Seu patrimônio</p>
    <div className="balance-row">
      <h1 className="display">{formatMoneyFromCents(totalCents)}</h1>
      <Link className="home-detail-link" href="/carteira">Ver carteira</Link>
    </div>
    {allocation.length > 0 ? <>
      <div className="distribution" aria-label="Distribuição da carteira">
        {allocation.map((item) => <span
          key={item.label}
          style={{ background: item.color, width: `${item.percentage}%` }}
        />)}
      </div>
      <div className="legend">
        {allocation.map((item) => <div key={item.label}>
          <span className="dot" style={{ background: item.color }} />
          {item.label} <b>{item.percentage.toLocaleString("pt-BR")}%</b>
        </div>)}
      </div>
    </> : <p className="home-empty-line">
      Nenhum ativo cadastrado. <Link href="/carteira/novo">Adicionar primeiro ativo →</Link>
    </p>}

    <section className="section">
      <p className="eyebrow">Continue sua jornada</p>
      <div className="shortcuts">
        {shortcuts.map(([icon, label, href]) => <Link className="shortcut" href={href} key={label}>
          <span className="shortcut-icon">{icon}</span>{label}
        </Link>)}
      </div>
    </section>

    <section className="section">
      <div className="section-head">
        <div><p className="eyebrow">Panorama oficial</p><h2>Indicadores</h2></div>
        <Link href="/mercado">Ver mercado</Link>
      </div>
      {indicators.length > 0 ? <div className="home-market-grid">
        {indicators.map((indicator) => <article className="market-card" key={indicator.code}>
          <p>{indicator.label}</p>
          <strong>{formatIndicatorValue(indicator)}</strong>
          <span data-stale={isIndicatorStale(indicator)}>
            {isIndicatorStale(indicator) ? "desatualizado · " : ""}
            {formatObservedDate(indicator.observed_on)}
          </span>
        </article>)}
      </div> : <div className="editorial">
        <p className="eyebrow">Aguardando primeira coleta</p>
        <h3>Os indicadores ainda não chegaram.</h3>
        <p>Assim que a rotina diária concluir, Selic e IPCA aparecerão aqui com fonte e data.</p>
      </div>}
    </section>

    <section className="section">
      <div className="section-head">
        <div><p className="eyebrow">North observa</p><h2>Próximo passo</h2></div>
      </div>
      <article className="editorial">
        <p className="eyebrow">{goalNeedsPace ? "Ritmo da meta" : "Carteira cadastrada"}</p>
        <h3>{goalNeedsPace
          ? `Seu plano está ${formatMoneyFromCents(goalProgress!.monthlyGapCents)} abaixo do ritmo mensal.`
          : positions.length > 0
            ? `${positions.length} ${positions.length === 1 ? "posição está" : "posições estão"} no seu histórico.`
            : "Comece pelo que você já possui."}</h3>
        <p>{goalNeedsPace
          ? "O North dividiu o valor restante pelo prazo, sem supor rentabilidade. Abra o assistente para entender os dados usados."
          : positions.length > 0
            ? "O patrimônio e a distribuição acima são derivados das movimentações registradas, sem estimativas inventadas."
            : "Cadastre suas compras para transformar o protótipo em um retrato real do seu patrimônio."}</p>
        <footer><span>Fato calculado pelo North</span><Link href="/assistente">Conversar →</Link></footer>
      </article>
    </section>

    <section className="section">
      <div className="section-head">
        <div><p className="eyebrow">Sua prioridade</p><h2>{goal?.name ?? "Defina uma meta"}</h2></div>
        <Link href="/metas">{goal ? "Detalhes" : "Começar"}</Link>
      </div>
      <div className="goal">
        {goal ? <>
          <p className="eyebrow">Meta cadastrada</p>
          <strong>{formatMoneyFromCents(goalProgress!.contributedCents)} de {formatMoneyFromCents(goalProgress!.targetCents)}</strong>
          <div className="progress"><span style={{ width: `${goalProgress!.percentage}%` }} /></div>
          <div className="goal-meta">
            <span>{goalProgress!.percentage.toLocaleString("pt-BR")}% concluída</span>
            <span>Prazo: {formatObservedDate(goal.target_date)}</span>
          </div>
        </> : <>
          <p className="eyebrow">Planejamento</p>
          <strong>Qual é sua prioridade?</strong>
          <p className="goal-copy">Crie uma meta com valor e prazo para acompanhar o plano sem confundir intenção com dinheiro já investido.</p>
        </>}
      </div>
    </section>
    <p className="status-note">O patrimônio vem das movimentações que você registrou. Indicadores exibem fonte e data observada. O North não executa ordens.</p>
  </AppShell>;
}
