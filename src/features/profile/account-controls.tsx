"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearNorthBrowserState } from "@/features/pwa/cache";
import { ACCOUNT_DELETION_PHRASE } from "./account";

export function AccountControls() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    setPending(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: form.get("confirmation"),
          password: form.get("password"),
        }),
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(result?.error ?? "Não foi possível excluir sua conta agora.");
        setPending(false);
        return;
      }

      await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
      await clearNorthBrowserState();
      window.location.replace("/");
    } catch {
      setError("Não foi possível excluir sua conta agora.");
      setPending(false);
    }
  }

  return <section className="account-data">
    <p className="eyebrow">Seus dados</p>
    <h2>Privacidade e controle</h2>
    <p>Baixe uma cópia legível dos dados que você cadastrou no North.</p>
    <a className="account-export" href="/api/account/export" download>
      Baixar meus dados <span>JSON ↓</span>
    </a>

    {!confirming ? <button
      className="account-delete-start"
      type="button"
      onClick={() => setConfirming(true)}
    >
      Excluir minha conta
    </button> : <form className="account-delete-form" onSubmit={deleteAccount}>
      <strong>Esta ação é permanente.</strong>
      <p>Carteira, metas, perfil, conversas e demais dados pessoais serão removidos.</p>
      <label>
        <span>Digite {ACCOUNT_DELETION_PHRASE}</span>
        <input
          name="confirmation"
          required
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        <span>Senha atual</span>
        <input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="account-delete-confirm" type="submit" disabled={pending}>
        {pending ? "Excluindo…" : "Excluir definitivamente"}
      </button>
      <button
        className="account-delete-cancel"
        type="button"
        disabled={pending}
        onClick={() => {
          setConfirming(false);
          setError("");
        }}
      >
        Cancelar
      </button>
    </form>}
  </section>;
}
