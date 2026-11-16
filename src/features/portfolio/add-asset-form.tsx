"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { todayInSaoPaulo } from "./submission";

const classOptions = [
  { value: "renda_fixa", label: "Renda fixa", color: "var(--rf)" },
  { value: "acoes", label: "Ações B3", color: "var(--ac)" },
  { value: "fundos", label: "Fundos", color: "var(--fu)" },
  { value: "fiis", label: "FIIs", color: "var(--fi)" },
  { value: "internacional", label: "Internacional", color: "var(--intl)" },
  { value: "cripto", label: "Cripto", color: "var(--cr)" },
  { value: "outros", label: "Outros", color: "var(--cx)" },
] as const;

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AddAssetForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const today = todayInSaoPaulo();

  function updateTotal(form: HTMLFormElement) {
    const data = new FormData(form);
    const quantity = toNumber(String(data.get("quantity") ?? ""));
    const price = toNumber(String(data.get("unitPrice") ?? ""));
    const fees = toNumber(String(data.get("fees") ?? ""));
    setTotal(quantity * price + fees);
  }

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

  return <form className="portfolio-form asset-form" onSubmit={submit} onInput={(event) => updateTotal(event.currentTarget)}>
    <div className="portfolio-form-head">
      <Link href="/carteira" aria-label="Voltar para a carteira">←</Link>
      <div><p className="eyebrow">Carteira manual</p><h1>Adicionar ativo</h1></div>
    </div>

    <div className="asset-layout">
      <div className="asset-main">
        <section className="form-card">
          <h2>O ativo</h2>
          <label className="auth-field"><span>Instituição</span>
            <input name="institutionName" required minLength={2} maxLength={80} placeholder="Ex.: Nubank" autoComplete="organization" autoCapitalize="words" autoCorrect="on" spellCheck />
          </label>
          <ChoiceChips label="Classe" name="assetClass" options={classOptions} defaultValue="acoes" />
          <div className="portfolio-field-row">
            <label className="auth-field"><span>Código</span>
              <input name="symbol" required maxLength={20} placeholder="PETR4" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            </label>
            <label className="auth-field"><span>Nome do ativo</span>
              <input name="name" required minLength={2} maxLength={100} placeholder="Ex.: Petrobras PN" autoCapitalize="words" autoCorrect="on" spellCheck />
            </label>
          </div>
        </section>

        <section className="form-card">
          <h2>A compra</h2>
          <div className="portfolio-field-row">
            <label className="auth-field"><span>Quantidade</span>
              <input name="quantity" required inputMode="decimal" pattern="^\d+(?:[,.]\d+)?$" title="Use apenas números e um separador decimal" placeholder="10" />
            </label>
            <label className="auth-field"><span>Preço unitário</span>
              <input name="unitPrice" required inputMode="decimal" pattern="^\d+(?:[,.]\d{1,2})?$" title="Use um valor positivo com até duas casas decimais" placeholder="37,50" />
            </label>
          </div>
          <div className="portfolio-field-row">
            <label className="auth-field"><span>Taxas</span>
              <input name="fees" required inputMode="decimal" pattern="^\d+(?:[,.]\d{1,2})?$" title="Informe uma taxa igual ou maior que zero" defaultValue="0,00" />
            </label>
            <DateField label="Data da compra" name="tradeDate" required max={today} today={today} defaultValue={today} />
          </div>
        </section>
      </div>

      <aside className="asset-side">
        <div className="asset-summary" aria-live="polite">
          <span>Total da compra</span>
          <strong>{brl.format(total)}</strong>
          <small>quantidade × preço + taxas</small>
        </div>
        <p className="portfolio-disclaimer">O valor atual começa com o preço informado. Quando houver cotação integrada, o North mostrará a fonte e o horário da atualização.</p>
        {error ? <p className="form-error portfolio-error" role="alert">{error}</p> : null}
        <button className="button portfolio-submit" type="submit" disabled={pending}>{pending ? "Salvando…" : "Adicionar à carteira"}</button>
      </aside>
    </div>
  </form>;
}
