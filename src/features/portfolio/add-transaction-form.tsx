"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { todayInSaoPaulo, transactionTypes } from "./submission";

type TransactionType = typeof transactionTypes[number];

const options: { value: TransactionType; label: string }[] = [
  { value: "compra", label: "Compra" },
  { value: "venda", label: "Venda" },
  { value: "aporte", label: "Aporte" },
  { value: "resgate", label: "Resgate" },
  { value: "rendimento", label: "Rendimento" },
  { value: "taxa", label: "Taxa" },
];

const positionTypes: TransactionType[] = ["compra", "venda", "aporte", "resgate"];

export function AddTransactionForm({
  instrument,
}: {
  instrument: { id: string; symbol: string; name: string };
}) {
  const router = useRouter();
  const [transactionType, setTransactionType] = useState<TransactionType>("compra");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const changesPosition = positionTypes.includes(transactionType);
  const today = todayInSaoPaulo();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch("/api/portfolio/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response?.ok) {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Não foi possível registrar a movimentação agora.");
      setPending(false);
      return;
    }

    router.push(`/carteira/${instrument.id}`);
    router.refresh();
  }

  return <form className="portfolio-form transaction-form" onSubmit={submit}>
    <input type="hidden" name="instrumentId" value={instrument.id} />
    <input type="hidden" name="transactionType" value={transactionType} />
    <div className="portfolio-form-head">
      <Link href={`/carteira/${instrument.id}`} aria-label="Voltar para o ativo">←</Link>
      <div><p className="eyebrow">{instrument.symbol} · movimentação</p><h1>{instrument.name}</h1></div>
    </div>

    <fieldset className="transaction-types">
      <legend>Tipo de movimentação</legend>
      {options.map((option) => <button
        type="button"
        key={option.value}
        data-selected={transactionType === option.value}
        onClick={() => {
          setTransactionType(option.value);
          setError("");
        }}
      >{option.label}</button>)}
    </fieldset>

    {changesPosition ? <>
      <div className="portfolio-field-row">
        <label className="auth-field"><span>Quantidade</span>
          <input name="quantity" required inputMode="decimal" pattern="^\\d+(?:[,.]\\d+)?$" title="Use apenas números e um separador decimal" placeholder="10" />
        </label>
        <label className="auth-field"><span>Preço unitário</span>
          <input name="unitPrice" required inputMode="decimal" pattern="^\\d+(?:[,.]\\d{1,2})?$" title="Use um valor positivo com até duas casas decimais" placeholder="37,50" />
        </label>
      </div>
      <label className="auth-field"><span>Taxas da operação</span>
        <input name="fees" required inputMode="decimal" pattern="^\\d+(?:[,.]\\d{1,2})?$" title="Informe uma taxa igual ou maior que zero" defaultValue="0,00" />
      </label>
      <input type="hidden" name="cashAmount" value="0" />
    </> : <>
      <label className="auth-field"><span>{transactionType === "rendimento" ? "Valor recebido" : "Valor da taxa"}</span>
        <input name="cashAmount" required inputMode="decimal" pattern="^\\d+(?:[,.]\\d{1,2})?$" title="Use um valor positivo com até duas casas decimais" placeholder="25,00" />
      </label>
      <input type="hidden" name="quantity" value="0" />
      <input type="hidden" name="unitPrice" value="0" />
      <input type="hidden" name="fees" value="0" />
    </>}

    <label className="auth-field"><span>Data</span>
      <input name="tradeDate" type="date" required max={today} defaultValue={today} />
    </label>

    <p className="portfolio-disclaimer">
      {transactionType === "venda" || transactionType === "resgate"
        ? "O North impede que a posição fique negativa, inclusive ao lançar datas anteriores."
        : "Depois de salva, a movimentação integra o histórico permanente deste ativo."}
    </p>
    {error ? <p className="form-error portfolio-error" role="alert">{error}</p> : null}
    <button className="button portfolio-submit" type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Registrar movimentação"}
    </button>
  </form>;
}
