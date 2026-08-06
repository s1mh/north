"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { todayInSaoPaulo } from "@/features/portfolio/submission";

export function GoalContributionForm({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const payload = {
      ...Object.fromEntries(new FormData(form).entries()),
      goalId,
    };

    const response = await fetch("/api/goals/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok) {
      setError(result?.error ?? "Não foi possível registrar o aporte agora.");
      setPending(false);
      return;
    }

    form.reset();
    setPending(false);
    router.refresh();
  }

  return <form className="goal-contribution-form" onSubmit={submit}>
    <div className="section-head">
      <div><p className="eyebrow">Histórico manual</p><h2>Registrar aporte</h2></div>
    </div>
    <div className="portfolio-field-row">
      <label className="auth-field"><span>Valor reservado</span>
        <input name="amount" required inputMode="decimal" pattern="^\\d+(?:[,.]\\d{1,2})?$" title="Use um valor positivo com até duas casas decimais" placeholder="500,00" />
      </label>
      <label className="auth-field"><span>Data</span>
        <input name="contributedOn" type="date" required max={todayInSaoPaulo()} defaultValue={todayInSaoPaulo()} />
      </label>
    </div>
    <label className="auth-field"><span>Observação opcional</span>
      <input name="note" maxLength={120} placeholder="Ex.: valor separado na conta" autoCapitalize="sentences" autoCorrect="on" spellCheck />
    </label>
    <p>Este registro acompanha sua organização. Ele não transfere nem aplica dinheiro.</p>
    {error ? <p className="form-error portfolio-error" role="alert">{error}</p> : null}
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Registrando…" : "Registrar no progresso"}
    </button>
  </form>;
}
