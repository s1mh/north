"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { goalKinds } from "@/features/goals/submission";
import { todayInSaoPaulo } from "@/features/portfolio/submission";

const kindOptions: Array<{
  value: typeof goalKinds[number];
  label: string;
  icon: string;
}> = [
  { value: "aposentadoria", label: "Aposentadoria", icon: "◌" },
  { value: "viagem", label: "Viagem", icon: "✈" },
  { value: "imovel", label: "Imóvel", icon: "⌂" },
  { value: "carro", label: "Carro", icon: "◇" },
  { value: "reserva", label: "Reserva", icon: "◎" },
  { value: "personalizada", label: "Personalizada", icon: "✎" },
];

function tomorrowInSaoPaulo() {
  const [year, month, day] = todayInSaoPaulo().split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + 1, 12));
  return date.toISOString().slice(0, 10);
}

export function NewGoalForm() {
  const router = useRouter();
  const [kind, setKind] = useState<typeof goalKinds[number]>("aposentadoria");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const payload = {
      ...Object.fromEntries(new FormData(event.currentTarget).entries()),
      kind,
    };

    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);

    if (!response?.ok || !result?.id) {
      setError(result?.error ?? "Não foi possível criar a meta agora.");
      setPending(false);
      return;
    }

    router.push(`/metas/${result.id}`);
    router.refresh();
  }

  return <form className="goal-form" onSubmit={submit}>
    <div className="portfolio-form-head">
      <Link href="/metas" aria-label="Voltar para metas">←</Link>
      <div><p className="eyebrow">Nova meta</p><h1>Qual é seu objetivo?</h1></div>
    </div>

    <fieldset className="goal-kind-options">
      <legend className="sr-only">Tipo de objetivo</legend>
      {kindOptions.map((option) => <button
        type="button"
        key={option.value}
        data-selected={kind === option.value}
        onClick={() => setKind(option.value)}
      ><span>{option.icon}</span>{option.label}</button>)}
    </fieldset>

    <label className="auth-field"><span>Nome da meta</span>
      <input name="name" required minLength={2} maxLength={80} placeholder="Ex.: Viagem · Japão" />
    </label>
    <label className="auth-field"><span>Quanto você quer juntar</span>
      <input name="targetAmount" required inputMode="decimal" placeholder="25.000,00" />
    </label>
    <div className="portfolio-field-row">
      <label className="auth-field"><span>Até quando</span>
        <input name="targetDate" type="date" required min={tomorrowInSaoPaulo()} />
      </label>
      <label className="auth-field"><span>Aporte mensal planejado</span>
        <input name="plannedMonthlyAmount" required inputMode="decimal" defaultValue="0,00" />
      </label>
    </div>

    <p className="portfolio-disclaimer">O aporte é um plano, não um débito automático. O progresso só considera valores que você registrar como já reservados para esta meta.</p>
    {error ? <p className="form-error portfolio-error" role="alert">{error}</p> : null}
    <button className="button portfolio-submit" type="submit" disabled={pending}>
      {pending ? "Criando…" : "Criar meta e ver plano"}
    </button>
  </form>;
}
