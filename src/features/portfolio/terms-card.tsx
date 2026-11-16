"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";
import {
  describeTerms,
  fgcLabels,
  fgcOptions,
  indexerLabels,
  indexers,
  liquidities,
  liquidityLabels,
  productTypeLabels,
  productTypes,
  taxLabels,
  taxRegimes,
  type InstrumentTerms,
} from "./terms";

const NONE = "";
const optionsFrom = <T extends string>(values: readonly T[], labels: Record<T, string>) => [
  { value: NONE, label: "Escolher" },
  ...values.map((value) => ({ value: value as string, label: labels[value] })),
];

const rateLabels: Record<string, { label: string; placeholder: string }> = {
  cdi_pct: { label: "Quantos % do CDI", placeholder: "120" },
  selic_pct: { label: "Quantos % da Selic", placeholder: "100" },
  ipca_mais: { label: "Taxa ao ano acima do IPCA (%)", placeholder: "6" },
  pre: { label: "Taxa ao ano (%)", placeholder: "11,5" },
};

export function TermsCard({
  instrumentId,
  terms,
  today,
}: {
  instrumentId: string;
  terms: InstrumentTerms | null;
  today: string;
}) {
  const router = useRouter();
  const rows = describeTerms(terms);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [productType, setProductType] = useState<string>(terms?.product_type ?? NONE);
  const [indexer, setIndexer] = useState<string>(terms?.indexer ?? NONE);
  const [liquidity, setLiquidity] = useState<string>(terms?.liquidity ?? NONE);
  const [taxRegime, setTaxRegime] = useState<string>(terms?.tax_regime ?? NONE);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = String(form.get(key) ?? "").trim();
      return value === "" ? null : value;
    };
    const days = text("liquidity_days");
    const payload = {
      product_type: productType || null,
      issuer: text("issuer"),
      indexer: indexer || null,
      rate: indexer && indexer !== "nenhum" && indexer !== "poupanca" ? text("rate") : null,
      start_date: text("start_date"),
      maturity_date: text("maturity_date"),
      liquidity: liquidity || null,
      liquidity_days: liquidity === "d_mais_n" && days ? Number(days) : null,
      fgc: text("fgc"),
      tax_regime: taxRegime || null,
    };
    setPending(true);
    const response = await fetch("/api/portfolio/terms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrumentId, terms: payload }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(result?.error ?? "Não foi possível salvar a ficha agora.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return <section className="terms-card" aria-labelledby="terms-title">
    <div className="section-head">
      <div><p className="eyebrow">Como esse investimento funciona</p><h2 id="terms-title">Ficha do ativo</h2></div>
      {!editing ? <button type="button" className="terms-edit" onClick={() => setEditing(true)}>
        {rows.length > 0 ? "Editar" : "Preencher"}
      </button> : null}
    </div>

    {!editing && rows.length === 0 ? <p className="terms-empty">
      Conte como esse investimento rende: taxa, vencimento, liquidez e se tem FGC. É opcional, e ajuda o north. a explicar melhor o seu saldo.
    </p> : null}

    {!editing && rows.length > 0 ? <dl className="terms-list">
      {rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl> : null}

    {editing ? <form className="terms-form" onSubmit={submit} noValidate>
      <div className="terms-field">
        <span>Tipo</span>
        <SelectField label="Tipo" value={productType} options={optionsFrom(productTypes, productTypeLabels)} onChange={setProductType} />
      </div>
      <label className="auth-field"><span>Emissor (quem emitiu)</span>
        <input name="issuer" defaultValue={terms?.issuer ?? ""} maxLength={80} placeholder="Ex.: Nu Financeira" />
      </label>
      <div className="terms-field">
        <span>Como rende</span>
        <SelectField label="Como rende" value={indexer} options={optionsFrom(indexers, indexerLabels)} onChange={setIndexer} />
      </div>
      {rateLabels[indexer] ? <label className="auth-field"><span>{rateLabels[indexer]?.label}</span>
        <input name="rate" inputMode="decimal" defaultValue={terms?.rate != null ? String(terms.rate).replace(".", ",") : ""} placeholder={rateLabels[indexer]?.placeholder} />
      </label> : null}
      <div className="portfolio-field-row">
        <DateField label="Início" name="start_date" max={today} today={today} defaultValue={terms?.start_date ?? ""} clearable />
        <DateField label="Vencimento" name="maturity_date" defaultValue={terms?.maturity_date ?? ""} clearable />
      </div>
      <div className="terms-field">
        <span>Resgate (liquidez)</span>
        <SelectField label="Resgate" value={liquidity} options={optionsFrom(liquidities, liquidityLabels)} onChange={setLiquidity} />
      </div>
      {liquidity === "d_mais_n" ? <label className="auth-field"><span>Quantos dias até cair na conta</span>
        <input name="liquidity_days" inputMode="numeric" defaultValue={terms?.liquidity_days ?? ""} placeholder="1" />
      </label> : null}
      <ChoiceChips
        label="Tem FGC?"
        name="fgc"
        options={fgcOptions.map((value) => ({ value, label: fgcLabels[value] }))}
        defaultValue={terms?.fgc ?? ""}
      />
      <p className="field-hint terms-hint">FGC é a garantia que protege até R$ 250 mil por CPF e por instituição. Confira no seu banco.</p>
      <div className="terms-field">
        <span>Imposto de renda</span>
        <SelectField label="Imposto de renda" value={taxRegime} options={optionsFrom(taxRegimes, taxLabels)} onChange={setTaxRegime} />
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="value-update-actions">
        <button type="submit" className="value-update-save" disabled={pending}>{pending ? "Salvando…" : "Salvar ficha"}</button>
        <button type="button" className="value-update-cancel" disabled={pending} onClick={() => { setEditing(false); setError(""); }}>Cancelar</button>
      </div>
    </form> : null}
  </section>;
}
