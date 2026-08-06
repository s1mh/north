"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Institution, ResearchRequest } from "@/features/institutions/types";

export function BankSelection({
  institutions,
  initialSelected,
  requests,
  nextPath = "/onboarding/perfil",
}: {
  institutions: Institution[];
  initialSelected: string[];
  requests: ResearchRequest[];
  nextPath?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected);
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [researchRequests, setResearchRequests] = useState(requests);

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function addCustom() {
    const name = custom.trim();
    if (name.length < 2 || pending) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/institutions/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || !result?.id) {
      setError(result?.error ?? "Não foi possível enviar a pesquisa agora.");
      setPending(false);
      return;
    }
    setResearchRequests((current) => [...current, {
      id: result.id,
      requested_name: name,
      status: "queued",
    }]);
    setCustom("");
    setAdding(false);
    setPending(false);
  }

  async function save() {
    if (selected.length === 0 || pending) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/institutions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionIds: selected }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok) {
      setError(result?.error ?? "Não foi possível salvar seus bancos agora.");
      setPending(false);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="bank-flow">
        <header className="onboarding-progress">
          <button type="button" onClick={() => router.back()} aria-label="Voltar">←</button>
          <div><span style={{ width: "50%" }} /></div>
          <span>2 / 4</span>
        </header>
        <h1>Onde você já tem conta?</h1>
        <p>Escolha seus bancos e corretoras. Vamos usar isso pra mostrar os produtos que cada um oferece.</p>
        <div className="bank-list">
          {institutions.map((institution) => {
            const active = selected.includes(institution.id);
            return (
              <button type="button" key={institution.id} data-selected={active} onClick={() => toggle(institution.id)}>
                <span className="bank-initial" style={{ background: `var(--${institution.color_token})` }}>{institution.initial}</span>
                <strong>{institution.name}</strong>
                <span className="bank-check">{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
        {adding ? (
          <div className="custom-bank">
            <input value={custom} maxLength={80} onChange={(event) => setCustom(event.target.value)} placeholder="Banco ou corretora" autoCapitalize="words" autoCorrect="on" spellCheck autoFocus />
            <button type="button" disabled={pending || custom.trim().length < 2} onClick={addCustom}>enviar</button>
          </div>
        ) : (
          <button className="add-bank" type="button" onClick={() => setAdding(true)}>+ <span>Adicionar manualmente<small>Entra em pesquisa e revisão; nada é publicado automaticamente</small></span></button>
        )}
        {researchRequests.length > 0 ? <div className="bank-research-list">
          <p className="eyebrow">Em pesquisa</p>
          {researchRequests.map((request) => <span key={request.id}>
            {request.requested_name}<small>aguardando revisão</small>
          </span>)}
        </div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button auth-submit" type="button" disabled={selected.length === 0 || pending} onClick={save}>
          {pending
            ? "Salvando…"
            : selected.length === 0
              ? "Selecione pelo menos um"
              : `Continuar · ${selected.length} selecionado${selected.length > 1 ? "s" : ""}`}
        </button>
      </section>
    </main>
  );
}
