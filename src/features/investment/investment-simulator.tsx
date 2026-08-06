"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  allocationAmounts,
  deriveProjection,
  investmentMoneyToCents,
  type ContributionFrequency,
} from "@/features/investment/calculation";
import { formatMoneyFromCents } from "@/features/portfolio/ledger";
import type { InvestorProfile } from "@/features/suitability/score";

type GoalOption = {
  id: string;
  name: string;
  remainingCents: string;
  horizonMonths: number;
  plannedMonthlyAmount: string | null;
};

type RecentSimulation = {
  id: string;
  mode: "free" | "goal";
  frequency: ContributionFrequency;
  contributionAmount: string;
  createdAt: string;
  goalName: string | null;
};

const profileLabels: Record<InvestorProfile, string> = {
  conservador: "Conservador",
  moderado: "Moderado",
  arrojado: "Arrojado",
};

const allocationPresentation: Record<string, { color: string; example: string }> = {
  "Renda Fixa": { color: "var(--rf)", example: "Tesouro ou CDB" },
  Fundos: { color: "var(--fu)", example: "Fundos diversificados" },
  "Ações · ETF": { color: "var(--ac)", example: "ETFs amplos" },
  FIIs: { color: "var(--fi)", example: "Fundos imobiliários" },
  Internacional: { color: "var(--intl)", example: "ETFs globais" },
  Cripto: { color: "var(--cr)", example: "Ativos de alta volatilidade" },
};

function normalizeMoney(value: string) {
  const trimmed = value.trim();
  if (/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(trimmed)) {
    return trimmed.replaceAll(".", "").replace(",", ".");
  }
  if (/^\d{1,15}(?:\.\d{1,2})?$/.test(trimmed)) return trimmed;
  return null;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function InvestmentSimulator({
  profile,
  initialAllocation,
  goals,
  recent,
}: {
  profile: InvestorProfile;
  initialAllocation: Record<string, number>;
  goals: GoalOption[];
  recent: RecentSimulation[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"free" | "goal">("free");
  const [frequency, setFrequency] = useState<ContributionFrequency>("once");
  const [amount, setAmount] = useState("5.000,00");
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [allocation, setAllocation] = useState(initialAllocation);
  const [editingAllocation, setEditingAllocation] = useState(false);
  const [annualReturnRate, setAnnualReturnRate] = useState(8);
  const [annualInflationRate, setAnnualInflationRate] = useState(4);
  const [annualFeeRate, setAnnualFeeRate] = useState(0.5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedGoal = goals.find((goal) => goal.id === goalId) ?? goals[0];
  const normalizedAmount = normalizeMoney(amount);
  const allocationTotal = Object.values(allocation).reduce((total, value) => total + value, 0);
  const projection = useMemo(() => {
    if (!normalizedAmount || allocationTotal !== 100) return null;
    try {
      return deriveProjection({
        contributionAmount: normalizedAmount,
        frequency,
        horizonMonths,
        annualReturnRate,
        annualInflationRate,
        annualFeeRate,
      });
    } catch {
      return null;
    }
  }, [
    normalizedAmount,
    allocationTotal,
    frequency,
    horizonMonths,
    annualReturnRate,
    annualInflationRate,
    annualFeeRate,
  ]);
  const distribution = useMemo(() => {
    if (!normalizedAmount || allocationTotal !== 100) return [];
    try {
      return allocationAmounts(normalizedAmount, allocation);
    } catch {
      return [];
    }
  }, [normalizedAmount, allocation, allocationTotal]);

  function chooseMode(nextMode: "free" | "goal") {
    setMode(nextMode);
    setSaved(false);
    if (nextMode === "goal" && selectedGoal) {
      setFrequency("monthly");
      setHorizonMonths(selectedGoal.horizonMonths);
      if (selectedGoal.plannedMonthlyAmount) {
        setAmount(String(selectedGoal.plannedMonthlyAmount).replace(".", ","));
      }
    }
  }

  function chooseGoal(nextGoalId: string) {
    setGoalId(nextGoalId);
    const goal = goals.find((item) => item.id === nextGoalId);
    if (goal) {
      setHorizonMonths(goal.horizonMonths);
      setAmount(goal.plannedMonthlyAmount?.replace(".", ",") ?? "500,00");
    }
  }

  async function saveSimulation() {
    if (!projection || !normalizedAmount || (mode === "goal" && !selectedGoal)) return;
    setPending(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/investment-simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        goalId: mode === "goal" ? selectedGoal!.id : null,
        frequency,
        contributionAmount: normalizedAmount,
        horizonMonths,
        annualReturnRate,
        annualInflationRate,
        annualFeeRate,
        allocation,
      }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || !result?.id) {
      setError(result?.error ?? "Não foi possível salvar a simulação agora.");
      setPending(false);
      return;
    }
    setPending(false);
    setSaved(true);
    router.refresh();
  }

  return <div className="investment-page">
    <div className="investment-heading">
      <p className="eyebrow">Planeje sem executar ordens</p>
      <h1>Investir</h1>
    </div>

    <div className="investment-mode" role="group" aria-label="Modo da simulação">
      <button type="button" data-selected={mode === "free"} onClick={() => chooseMode("free")}>Livre</button>
      <button
        type="button"
        data-selected={mode === "goal"}
        disabled={goals.length === 0}
        onClick={() => chooseMode("goal")}
      >Para uma meta</button>
    </div>
    {goals.length === 0 ? <Link className="investment-mode-hint" href="/metas/nova">
      <strong>Criar uma meta</strong><span>Simule um plano ligado a um objetivo</span><b aria-hidden="true">→</b>
    </Link> : null}

    {mode === "goal" && selectedGoal ? <label className="investment-goal">
      <span><small>Meta</small>
        <select value={selectedGoal.id} onChange={(event) => chooseGoal(event.target.value)}>
          {goals.map((goal) => <option value={goal.id} key={goal.id}>{goal.name}</option>)}
        </select>
      </span>
      <strong><small>faltam</small>{formatMoneyFromCents(BigInt(selectedGoal.remainingCents))}</strong>
    </label> : null}

    <label className="investment-amount">
      <span>R$</span>
      <input
        aria-label="Valor do aporte"
        inputMode="decimal"
        value={amount}
        onChange={(event) => { setAmount(event.target.value); setSaved(false); }}
      />
    </label>

    <div className="investment-frequency" role="group" aria-label="Frequência do aporte">
      <button type="button" data-selected={frequency === "once"} onClick={() => setFrequency("once")}>Aporte único</button>
      <button type="button" data-selected={frequency === "monthly"} onClick={() => setFrequency("monthly")}>Todo mês</button>
    </div>

    {mode === "free" ? <label className="investment-horizon">
      <span>Horizonte</span>
      <select value={horizonMonths} onChange={(event) => setHorizonMonths(Number(event.target.value))}>
        <option value={12}>12 meses</option>
        <option value={36}>3 anos</option>
        <option value={60}>5 anos</option>
        <option value={120}>10 anos</option>
        <option value={240}>20 anos</option>
      </select>
    </label> : null}

    <div className="investment-allocation-head">
      <span>Distribuição · perfil</span>
      <strong>{profileLabels[profile]}</strong>
      <button type="button" onClick={() => setEditingAllocation((value) => !value)}>
        {editingAllocation ? "concluir" : "editar"}
      </button>
    </div>
    <div className="investment-allocation">
      {(distribution.length > 0
        ? distribution
        : Object.entries(allocation).map(([label, percentage]) => ({
          label,
          percentage,
          cents: normalizedAmount
            ? (investmentMoneyToCents(normalizedAmount) * BigInt(percentage)) / 100n
            : 0n,
        }))
      ).map((item) => <div
        className="investment-allocation-row"
        style={{ background: allocationPresentation[item.label]?.color ?? "var(--cx)" }}
        key={item.label}
      >
        {editingAllocation ? <label>
          <span className="sr-only">Percentual de {item.label}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={allocation[item.label]}
            onChange={(event) => setAllocation((current) => ({
              ...current,
              [item.label]: Math.max(0, Math.min(100, Number(event.target.value))),
            }))}
          /><span>%</span>
        </label> : <strong>{item.percentage}%</strong>}
        <span><b>{item.label}</b><small>{allocationPresentation[item.label]?.example}</small></span>
        <b>{formatMoneyFromCents(item.cents)}</b>
      </div>)}
    </div>
    {allocationTotal !== 100 ? <p className="form-error investment-allocation-error" role="alert">
      A distribuição está em {allocationTotal}%. Ajuste para fechar em 100%.
    </p> : null}

    <section className="investment-assumptions">
      <div><p className="eyebrow">Premissas editáveis</p><strong>{horizonMonths} meses</strong></div>
      <div className="investment-assumption-grid">
        <label><span>Retorno ao ano</span><input type="number" min={0} max={30} step={0.1} value={annualReturnRate} onChange={(event) => setAnnualReturnRate(Number(event.target.value))} /><b>%</b></label>
        <label><span>Inflação ao ano</span><input type="number" min={0} max={20} step={0.1} value={annualInflationRate} onChange={(event) => setAnnualInflationRate(Number(event.target.value))} /><b>%</b></label>
        <label><span>Taxas ao ano</span><input type="number" min={0} max={10} step={0.1} value={annualFeeRate} onChange={(event) => setAnnualFeeRate(Number(event.target.value))} /><b>%</b></label>
      </div>
    </section>

    <section className="investment-projection">
      <p className="eyebrow">Estimativa educacional</p>
      {projection ? <>
        <p>Você contribuiria <strong>{formatMoneyFromCents(projection.contributedCents)}</strong> e poderia chegar a <strong>{formatMoneyFromCents(projection.projectedNominalCents)}</strong>.</p>
        <div><span>Em dinheiro de hoje, após inflação</span><strong>{formatMoneyFromCents(projection.projectedRealCents)}</strong></div>
        {mode === "goal" && selectedGoal ? <small>
          Compare a projeção com os {formatMoneyFromCents(BigInt(selectedGoal.remainingCents))} restantes da meta.
        </small> : null}
      </> : <p>Revise o valor, o prazo e as premissas para calcular este cenário.</p>}
    </section>

    <p className="investment-disclaimer">
      Cálculo nominal com aportes no fim de cada mês, retorno constante e taxas descontadas do retorno. Não inclui impostos, oscilação, liquidez nem garante resultado futuro. As classes e exemplos são educacionais, não recomendações.
    </p>
    {error ? <p className="form-error investment-save-message" role="alert">{error}</p> : null}
    {saved ? <p className="investment-save-message" role="status">Simulação salva. Nenhuma ordem ou transferência foi realizada.</p> : null}
    <button
      className="button investment-save"
      type="button"
      disabled={pending || !projection || allocationTotal !== 100 || (mode === "goal" && !selectedGoal)}
      onClick={saveSimulation}
    >{pending ? "Salvando…" : "Salvar simulação"}</button>

    {recent.length > 0 ? <section className="recent-simulations">
      <div className="section-head"><div><p className="eyebrow">Histórico imutável</p><h2>Planos salvos</h2></div></div>
      {recent.map((simulation) => <article key={simulation.id}>
        <div><strong>{simulation.goalName ?? "Simulação livre"}</strong><span>{simulation.frequency === "monthly" ? "Todo mês" : "Aporte único"} · {dateLabel(simulation.createdAt)}</span></div>
        <b>{formatMoneyFromCents(investmentMoneyToCents(simulation.contributionAmount))}</b>
      </article>)}
    </section> : null}
  </div>;
}
