"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { signInSchema } from "./auth-schema";

export function SignInForm() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      setError("Confira o e-mail e a senha.");
      return;
    }

    setSending(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
      if (signInError) throw signInError;
      router.push("/inicio");
      router.refresh();
    } catch {
      setError("E-mail ou senha incorretos.");
      setSending(false);
    }
  }

  return (
    <form className="auth-form sign-in-form" onSubmit={submit} noValidate>
      <header className="onboarding-progress">
        <Link href="/" aria-label="Voltar">←</Link>
        <div><span style={{ width: "100%" }} /></div>
        <span>entrar</span>
      </header>
      <p className="eyebrow">Que bom ter você de volta</p>
      <h1>Entre no North</h1>
      <label className="auth-field">
        <span>(01) E-mail</span>
        <input name="email" type="email" autoComplete="email" placeholder="voce@email.com" />
      </label>
      <label className="auth-field">
        <span>(02) Senha</span>
        <input name="password" type="password" autoComplete="current-password" placeholder="Sua senha" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" type="submit" disabled={sending}>{sending ? "Entrando…" : "Entrar"}</button>
      <p className="auth-switch">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p>
    </form>
  );
}
