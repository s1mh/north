"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { todayInSaoPaulo } from "./submission";

const classOptions = [
  ["renda_fixa", "Renda fixa"],
  ["acoes", "Ações B3"],
  ["fundos", "Fundos"],
  ["fiis", "FIIs"],
  ["internacional", "Internacional"],
  ["cripto", "Cripto"],
  ["outros", "Outros"],
] as const;

export function AddAssetForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const today = todayInSaoPaulo();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch("/api/portfolio/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response?.ok) {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Não foi possível adicionar o ativo agora.");
      setPending(false);
      return;
    }

    router.push("/carteira");
    router.refresh();
  }

  return <form className="portfolio-form" onSubmit={submit}>
    <div className="portfolio-form-head">
      <Link href="/carteira" aria-label="Voltar para a carteira">←</Link>
      <div><p className="eyebrow">Carteira manual</p><h1>Adicionar ativo</h1></div>
    </div>

    <label className="auth-field"><span>Instituição</span>
      <input name="institutionName" required minLength={2} maxLength={80} placeholder="Ex.: Nubank" autoComplete="organization" />
    </label>
    <div className="portfolio-field-row">
      <label className="auth-field"><span>Código</span>
        <input name="symbol" required maxLength={20} placeholder="PETR4" autoCapitalize="characters" />
      </label>
      <label className="auth-field"><span>Classe</span>
        <select name="assetClass" defaultValue="acoes">{classOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      </label>
    </div>
    <label className="auth-field"><span>Nome do ativo</span>
      <input name="name" required minLength={2} maxLength={100} placeholder="Ex.: Petrobras PN" />
    </label>
    <div className="portfolio-field-row">
      <label className="auth-field"><span>Quantidade</span>
        <input name="quantity" required inputMode="decimal" placeholder="10" />
      </label>
      <label className="auth-field"><span>Preço unitário</span>
        <input name="unitPrice" required inputMode="decimal" placeholder="37,50" />
      </label>
    </div>
    <div className="portfolio-field-row">
      <label className="auth-field"><span>Taxas</span>
        <input name="fees" required inputMode="decimal" defaultValue="0,00" />
      </label>
      <label className="auth-field"><span>Data da compra</span>
        <input name="tradeDate" type="date" required max={today} defaultValue={today} />
      </label>
    </div>

    <p className="portfolio-disclaimer">O valor atual começa com o preço informado. Quando houver cotação integrada, o North mostrará a fonte e o horário da atualização.</p>
    {error ? <p className="form-error portfolio-error" role="alert">{error}</p> : null}
    <button className="button portfolio-submit" type="submit" disabled={pending}>{pending ? "Salvando…" : "Adicionar à carteira"}</button>
  </form>;
}
