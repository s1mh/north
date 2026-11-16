"use client";

import { useState, type FormEvent } from "react";
import { emailChangeSchema, passwordChangeSchema } from "./credentials";

type Mode = "none" | "password" | "email";

async function send(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  return { ok: response.ok, error: result?.error };
}

export function CredentialSettings({ currentEmail }: { currentEmail: string }) {
  const [mode, setMode] = useState<Mode>("none");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function open(next: Mode) {
    setMode(next);
    setError("");
    setDone("");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: form.get("currentPassword"),
      password: form.get("password"),
      confirmation: form.get("confirmation"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setPending(true);
    const result = await send("/api/account/password", parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível alterar a senha agora.");
      return;
    }
    setMode("none");
    setDone("Senha alterada. Os outros aparelhos perdem o acesso em até 1 hora.");
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = emailChangeSchema.safeParse({
      currentPassword: form.get("currentPassword"),
      email: form.get("email"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setPending(true);
    const result = await send("/api/account/email", parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível pedir a troca de e-mail agora.");
      return;
    }
    setMode("none");
    setDone("Enviamos um link de confirmação para o e-mail novo e outro para o atual. O e-mail só muda depois que você confirmar nos dois.");
  }

  return <section className="credential-settings">
    <p className="eyebrow">Acesso</p>
    <h2>Senha e e-mail</h2>
    <p>E-mail atual: <strong>{currentEmail}</strong></p>

    {done && <p className="credential-done" role="status">{done}</p>}

    {mode === "none" && <div className="credential-actions">
      <button type="button" onClick={() => open("password")}>Alterar senha <b>›</b></button>
      <button type="button" onClick={() => open("email")}>Alterar e-mail <b>›</b></button>
    </div>}

    {mode === "password" && <form className="credential-form" onSubmit={changePassword} noValidate>
      <label><span>Senha atual</span>
        <input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} />
      </label>
      <label><span>Nova senha</span>
        <input name="password" type="password" autoComplete="new-password" maxLength={128} placeholder="10+ caracteres" />
        <small>Maiúscula, minúscula, número e símbolo.</small>
      </label>
      <label><span>Confirmar nova senha</span>
        <input name="confirmation" type="password" autoComplete="new-password" maxLength={128} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="credential-submit" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
      <button className="credential-cancel" type="button" disabled={pending} onClick={() => open("none")}>Cancelar</button>
    </form>}

    {mode === "email" && <form className="credential-form" onSubmit={changeEmail} noValidate>
      <label><span>Novo e-mail</span>
        <input name="email" type="email" autoComplete="email" maxLength={254} />
      </label>
      <label><span>Senha atual</span>
        <input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="credential-submit" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar links de confirmação"}
      </button>
      <button className="credential-cancel" type="button" disabled={pending} onClick={() => open("none")}>Cancelar</button>
    </form>}
  </section>;
}
