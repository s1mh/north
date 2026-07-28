"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordResetRequestSchema } from "./auth-schema";

export function ResetPasswordForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = passwordResetRequestSchema.safeParse({ email: form.get("email") });
    if (!parsed.success) {
      setError("Digite um e-mail válido.");
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <section className="auth-confirmation" aria-live="polite">
        <p className="eyebrow">Confira sua caixa de entrada</p>
        <h1>Se a conta existir, o link está a caminho.</h1>
        <p>Por segurança, a mensagem é a mesma para todos os endereços.</p>
        <Link className="button" href="/entrar">Voltar para entrar</Link>
      </section>
    );
  }

  return (
    <form className="auth-form sign-in-form" onSubmit={submit} noValidate>
      <header className="onboarding-progress">
        <Link href="/entrar" aria-label="Voltar">←</Link>
        <div><span style={{ width: "100%" }} /></div>
        <span>recuperar</span>
      </header>
      <p className="eyebrow">Recupere seu acesso</p>
      <h1>Qual é o seu e-mail?</h1>
      <label className="auth-field">
        <span>(01) E-mail</span>
        <input name="email" type="email" autoComplete="email" placeholder="voce@email.com" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : "Enviar link seguro"}
      </button>
    </form>
  );
}
