"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { transactionTypes } from "./submission";

type TransactionType = typeof transactionTypes[number];

type EditableTransaction = {
  id: string;
  transaction_type: TransactionType;
  quantity: string | number;
  unit_price: string | number;
  fees: string | number;
  cash_amount: string | number;
  trade_date: string;
};

const options: { value: TransactionType; label: string }[] = [
  { value: "compra", label: "Compra" },
  { value: "venda", label: "Venda" },
  { value: "aporte", label: "Aporte" },
  { value: "resgate", label: "Resgate" },
  { value: "rendimento", label: "Rendimento" },
  { value: "taxa", label: "Taxa" },
];

function inputValue(value: string | number) {
  return String(value).replace(".", ",");
}

export function CorrectTransactionForm({
  instrument,
  transaction,
}: {
  instrument: { id: string; symbol: string; name: string };
  transaction: EditableTransaction;
}) {
  const router = useRouter();
  const [transactionType, setTransactionType] = useState(transaction.transaction_type);
  const [pending, setPending] = useState(false);
  const [confirmingReversal, setConfirmingReversal] = useState(false);
  const [error, setError] = useState("");
  const changesPosition = ["compra", "venda", "aporte", "resgate"].includes(transactionType);

  async function correct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/portfolio/transactions/audit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response?.ok) {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Não foi possível salvar a correção.");
      setPending(false);
      return;
    }

    router.push(`/carteira/${instrument.id}`);
    router.refresh();
  }

  async function reverse(form: HTMLFormElement) {
    if (!confirmingReversal) {
      setConfirmingReversal(true);
      setError("");
      return;
    }

    const reason = String(new FormData(form).get("reason") ?? "").trim();
    if (reason.length < 3) {
      setError("Informe o motivo do estorno.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/portfolio/transactions/audit", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: transaction.id, reason }),
    }).catch(() => null);

    if (!response?.ok) {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Não foi possível estornar a movimentação.");
      setPending(false);
      return;
    }

    router.push(`/carteira/${instrument.id}`);
    router.refresh();
  }

  return <form className="portfolio-form transaction-form" onSubmit={correct}>
    <input type="hidden" name="transactionId" value={transaction.id} />
    <input type="hidden" name="transactionType" value={transactionType} />
    <div className="portfolio-form-head">
      <Link href={`/carteira/${instrument.id}`} aria-label="Voltar para o ativo">←</Link>
      <div><p className="eyebrow">{instrument.symbol} · auditoria</p><h1>Corrigir movimentação</h1></div>
    </div>

    <fieldset className="transaction-types">
      <legend>Tipo corrigido</legend>
      {options.map((option) => <button
        type="button"
        key={option.value}
        data-selected={transactionType === option.value}
        onClick={() => {
          setTransactionType(option.value);
          setConfirmingReversal(false);
        }}
      >{option.label}</button>)}
    </fieldset>

    {changesPosition ? <>
      <div className="portfolio-field-row">
        <label className="auth-field"><span>Quantidade corrigida</span>
          <input name="quantity" required inputMode="decimal" defaultValue={inputValue(transaction.quantity)} />
        </label>
        <label className="auth-field"><span>Preço corrigido</span>
          <input name="unitPrice" required inputMode="decimal" defaultValue={inputValue(transaction.unit_price)} />
        </label>
      </div>
      <label className="auth-field"><span>Taxas corrigidas</span>
        <input name="fees" required inputMode="decimal" defaultValue={inputValue(transaction.fees)} />
      </label>
      <input type="hidden" name="cashAmount" value="0" />
    </> : <>
      <label className="auth-field"><span>Valor corrigido</span>
        <input name="cashAmount" required inputMode="decimal" defaultValue={inputValue(transaction.cash_amount)} />
      </label>
      <input type="hidden" name="quantity" value="0" />
      <input type="hidden" name="unitPrice" value="0" />
      <input type="hidden" name="fees" value="0" />
    </>}

    <label className="auth-field"><span>Data corrigida</span>
      <input name="tradeDate" type="date" required defaultValue={transaction.trade_date} />
    </label>
    <label className="auth-field"><span>Motivo da alteração</span>
      <input name="reason" required minLength={3} maxLength={200} placeholder="Ex.: preço digitado incorretamente" autoCapitalize="sentences" autoCorrect="on" spellCheck />
    </label>

    <p className="portfolio-disclaimer">O lançamento original continuará visível no histórico, acompanhado do estorno e da correção.</p>
    {error ? <p className="form-error portfolio-error" role="alert">{error}</p> : null}
    <button className="button portfolio-submit" type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar correção"}
    </button>
    <button
      className="danger-action"
      type="button"
      disabled={pending}
      onClick={(event) => reverse(event.currentTarget.form!)}
    >
      {confirmingReversal ? "Confirmar estorno sem substituição" : "Estornar movimentação"}
    </button>
  </form>;
}
