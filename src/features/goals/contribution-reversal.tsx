"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContributionReversal({ contributionId }: { contributionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function reverse() {
    if (reason.trim().length < 3 || pending) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/goals/contributions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contributionId, reason }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Não foi possível estornar o aporte agora.");
      setPending(false);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return <button className="goal-contribution-reverse" type="button" onClick={() => setConfirming(true)}>Estornar</button>;
  }

  return <div className="goal-contribution-reversal">
    <input
      value={reason}
      onChange={(event) => setReason(event.target.value)}
      maxLength={160}
      placeholder="Motivo do estorno"
      aria-label="Motivo do estorno"
    />
    <button type="button" disabled={pending || reason.trim().length < 3} onClick={reverse}>
      {pending ? "Estornando…" : "Confirmar"}
    </button>
    <button type="button" disabled={pending} onClick={() => { setConfirming(false); setReason(""); setError(""); }}>Cancelar</button>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </div>;
}
