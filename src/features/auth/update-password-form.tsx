"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordUpdateSchema } from "./auth-schema";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = passwordUpdateSchema.safeParse({
      password: form.get("password"),
      confirmation: form.get("confirmation"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira as duas senhas.");
      return;
    }

    setSending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (updateError) {
      setError("Não foi possível atualizar a senha. Solicite um novo link.");
      setSending(false);
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <form className="auth-form sign-in-form" onSubmit={submit} noValidate>
      <header className="onboarding-progress">
        <span aria-hidden="true">✓</span>
        <div><span style={{ width: "100%" }} /></div>
        <span>nova senha</span>
      </header>
      <p className="eyebrow">Proteja sua conta</p>
      <h1>Crie uma nova senha</h1>
      <label className="auth-field">
        <span>(01) Nova senha</span>
        <input name="password" type="password" autoComplete="new-password" placeholder="10+ caracteres" />
        <small className="field-hint">Maiúscula, minúscula, número e símbolo.</small>
      </label>
      <label className="auth-field">
        <span>(02) Confirmar senha</span>
        <input name="confirmation" type="password" autoComplete="new-password" placeholder="Repita a nova senha" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" type="submit" disabled={sending}>
        {sending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
