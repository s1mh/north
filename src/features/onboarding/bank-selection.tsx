"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const institutions = [
  { name: "Nubank", initial: "N", color: "var(--cr)" },
  { name: "Itaú", initial: "I", color: "var(--intl)" },
  { name: "BTG Pactual", initial: "B", color: "var(--rf)" },
  { name: "XP Investimentos", initial: "X", color: "var(--ac)" },
  { name: "C6 Bank", initial: "C", color: "var(--fi)" },
] as const;

export function BankSelection() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);

  function toggle(name: string) {
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function addCustom() {
    const name = custom.trim();
    if (!name || selected.includes(name)) return;
    setSelected((current) => [...current, name]);
    setCustom("");
    setAdding(false);
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
            const active = selected.includes(institution.name);
            return (
              <button type="button" key={institution.name} data-selected={active} onClick={() => toggle(institution.name)}>
                <span className="bank-initial" style={{ background: institution.color }}>{institution.initial}</span>
                <strong>{institution.name}</strong>
                <span className="bank-check">{active ? "✓" : ""}</span>
              </button>
            );
          })}
          {selected.filter((name) => !institutions.some((institution) => institution.name === name)).map((name) => (
            <button type="button" key={name} data-selected onClick={() => toggle(name)}>
              <span className="bank-initial">+</span><strong>{name}</strong><span className="bank-check">✓</span>
            </button>
          ))}
        </div>
        {adding ? (
          <div className="custom-bank">
            <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Banco ou corretora" autoFocus />
            <button type="button" onClick={addCustom}>adicionar</button>
          </div>
        ) : (
          <button className="add-bank" type="button" onClick={() => setAdding(true)}>+ <span>Adicionar manualmente<small>Você poderá revisar os produtos depois</small></span></button>
        )}
        <button className="button auth-submit" type="button" disabled={selected.length === 0} onClick={() => router.push("/onboarding/perfil")}>
          {selected.length === 0 ? "Selecione pelo menos um" : `Continuar · ${selected.length} selecionado${selected.length > 1 ? "s" : ""}`}
        </button>
      </section>
    </main>
  );
}
