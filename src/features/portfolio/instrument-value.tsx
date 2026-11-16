"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DateField } from "@/components/ui/date-field";
import {
  brazilianMoneySubmissionValue,
  completeBrazilianMoneyInput,
  formatBrazilianMoneyInput,
} from "@/features/goals/money-input";

/** "Atualizar valor": a pessoa informa quanto o ativo vale hoje (o north. não consulta o banco). */
export function InstrumentValue({ instrumentId, today }: { instrumentId: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const totalValue = brazilianMoneySubmissionValue(amount);
    if (!/^\d/.test(totalValue) || Number(totalValue.replace(/\./g, "").replace(",", ".")) <= 0) {
      setError("Digite o valor que aparece hoje no seu banco ou corretora.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/portfolio/valuations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrumentId,
        totalValue: totalValue.replace(/\./g, ""),
        valuedOn: form.get("valuedOn"),
      }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(result?.error ?? "Não foi possível atualizar o valor agora.");
      return;
    }
    setOpen(false);
    setAmount("");
    router.refresh();
  }

  if (!open) {
    return <button type="button" className="value-update-open" onClick={() => setOpen(true)}>
      Atualizar valor
    </button>;
  }

  return <form className="value-update-form" onSubmit={submit} noValidate>
    <label className="auth-field">
      <span>Quanto vale hoje (R$)</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 507,39"
        value={amount}
        onChange={(event) => setAmount(formatBrazilianMoneyInput(event.target.value))}
        onBlur={() => setAmount(completeBrazilianMoneyInput(amount))}
      />
      <small className="field-hint">Use o valor que o seu banco ou corretora mostra. O north. não consulta a instituição.</small>
    </label>
    <DateField label="Valor de qual dia" name="valuedOn" required max={today} today={today} defaultValue={today} />
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="value-update-actions">
      <button type="submit" className="value-update-save" disabled={pending}>{pending ? "Salvando…" : "Salvar valor"}</button>
      <button type="button" className="value-update-cancel" disabled={pending} onClick={() => { setOpen(false); setError(""); }}>Cancelar</button>
    </div>
  </form>;
}
