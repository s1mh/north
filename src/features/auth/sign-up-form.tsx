"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  signUpSchema,
  type SignUpInput,
} from "./auth-schema";
import { LegalReviewDialog, type LegalDocument } from "./legal-review-dialog";

type FieldErrors = Partial<Record<keyof SignUpInput, string>>;

export function SignUpForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "confirmation">("idle");
  const [formError, setFormError] = useState("");
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      displayName: form.get("displayName"),
      email: form.get("email"),
      password: form.get("password"),
      acceptedTerms: form.get("acceptedTerms") === "on",
    });

    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        displayName: fields.displayName?.[0],
        email: fields.email?.[0],
        password: fields.password?.[0],
        acceptedTerms: fields.acceptedTerms?.[0],
      });
      return;
    }

    setErrors({});
    setStatus("sending");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/bancos`,
          data: {
            display_name: parsed.data.displayName,
            consent_terms_version: TERMS_VERSION,
            consent_privacy_version: PRIVACY_VERSION,
          },
        },
      });

      if (error) throw error;
      if (data.session) {
        router.push("/onboarding/bancos");
        router.refresh();
      } else {
        setStatus("confirmation");
      }
    } catch {
      setStatus("idle");
      setFormError("Não foi possível criar a conta agora. Tente novamente em alguns minutos.");
    }
  }

  if (status === "confirmation") {
    return (
      <section className="auth-confirmation" aria-live="polite">
        <p className="eyebrow">Só falta confirmar</p>
        <h1>Confira seu e-mail.</h1>
        <p>Enviamos um link para confirmar sua conta. Depois dele, você continua escolhendo seus bancos.</p>
        <Link className="button" href="/entrar">Já confirmei · entrar</Link>
      </section>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <header className="onboarding-progress">
        <Link href="/" aria-label="Voltar">←</Link>
        <div><span style={{ width: "25%" }} /></div>
        <span>1 / 4</span>
      </header>
      <h1>Vamos criar sua conta</h1>

      <label className="auth-field">
        <span>(01) Nome completo</span>
        <input
          name="displayName"
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="on"
          spellCheck
          enterKeyHint="next"
          placeholder="Seu nome"
          aria-invalid={Boolean(errors.displayName)}
        />
        {errors.displayName && <small>{errors.displayName}</small>}
      </label>
      <label className="auth-field">
        <span>(02) E-mail</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" placeholder="voce@email.com" aria-invalid={Boolean(errors.email)} />
        {errors.email && <small>{errors.email}</small>}
      </label>
      <label className="auth-field">
        <span>(03) Senha</span>
        <div className="password-field">
          <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" placeholder="10+ caracteres" aria-invalid={Boolean(errors.password)} />
          <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "ocultar" : "mostrar"}</button>
        </div>
        {errors.password ? <small>{errors.password}</small> : <small className="field-hint">Maiúscula, minúscula, número e símbolo.</small>}
      </label>

      <label className="consent-field">
        <input name="acceptedTerms" type="checkbox" />
        <span>Li e aceito os <button type="button" onClick={() => setLegalDocument("terms")}>Termos de Uso</button> e a <button type="button" onClick={() => setLegalDocument("privacy")}>Política de Privacidade</button> do North.</span>
      </label>
      {errors.acceptedTerms && <small className="form-error">{errors.acceptedTerms}</small>}
      {formError && <p className="form-error" role="alert">{formError}</p>}

      <button className="button auth-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Criando conta…" : "Continuar"}
      </button>
      <p className="auth-switch">Já tem conta? <Link href="/entrar">Entrar</Link></p>
      {legalDocument ? <LegalReviewDialog
        document={legalDocument}
        onClose={() => setLegalDocument(null)}
      /> : null}
    </form>
  );
}
