"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { destinationAfterSignIn, getSecondFactorStatus } from "@/features/auth/after-sign-in";

export function MfaChallengeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"code" | "recovery">("code");
  const [method, setMethod] = useState<"totp" | "email" | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const requested = useRef(false);

  const sendEmailCode = useCallback(async () => {
    setError(""); setInfo("");
    try {
      const response = await fetch("/api/auth/email-2fa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "login" }),
      });
      if (response.status === 429) { setError("Muitos pedidos de código. Tente de novo em 1 hora."); return; }
      if (!response.ok) throw new Error("send");
      setInfo("Enviamos um código de 6 números para o seu e-mail. Ele vale por 10 minutos.");
      setCooldown(60);
    } catch {
      setError("Não foi possível enviar o código agora. Tente reenviar em instantes.");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/entrar"); return; }
      const status = await getSecondFactorStatus(supabase);
      if (!status.method || status.satisfied) { router.replace(await destinationAfterSignIn(supabase)); return; }
      setMethod(status.method);
      if (status.method === "email" && !requested.current) { requested.current = true; await sendEmailCode(); }
    })();
  }, [router, sendEmailCode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) { setError("Digite os 6 números enviados para o seu e-mail."); return; }
    setSending(true);
    try {
      const response = await fetch("/api/auth/email-2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "login", code }),
      });
      if (response.status === 429) { setError("Muitas tentativas. Peça um código novo."); setSending(false); return; }
      if (!response.ok) throw new Error("verify");
      const supabase = createClient();
      router.push(await destinationAfterSignIn(supabase));
      router.refresh();
    } catch {
      setError("Código incorreto ou expirado. Confira o e-mail ou peça um novo.");
      setSending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) { setError("Digite os 6 números do aplicativo."); return; }
    setSending(true);
    try {
      const supabase = createClient();
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (listError || !factor) throw new Error("no_factor");
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError || !challenge) throw challengeError ?? new Error("challenge");
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      router.push(await destinationAfterSignIn(supabase));
      router.refresh();
    } catch {
      setError("Código incorreto ou expirado. Confira o aplicativo e tente de novo.");
      setSending(false);
    }
  }

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const code = String(new FormData(event.currentTarget).get("recovery") ?? "").trim();
    if (code.length < 8) { setError("Digite um código de recuperação completo."); return; }
    setSending(true);
    try {
      const response = await fetch("/api/account/mfa/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (response.status === 429) { setError("Muitas tentativas. Tente de novo em 1 hora ou escreva para a gente."); setSending(false); return; }
      if (!response.ok) throw new Error("recover");
      await createClient().auth.refreshSession();
      router.push("/perfil?mfa=reativar");
      router.refresh();
    } catch {
      setError("Esse código não funcionou. Cada código vale uma vez só.");
      setSending(false);
    }
  }

  if (method === "email") {
    return (
      <form className="auth-form" onSubmit={verifyEmail} noValidate>
        <p className="eyebrow">Verificação em duas etapas</p>
        <h1>Digite o código do seu e-mail</h1>
        {info && <p className="mfa-help">{info}</p>}
        <label className="auth-field">
          <span>Código</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" autoFocus />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button auth-submit" type="submit" disabled={sending}>{sending ? "Verificando…" : "Verificar"}</button>
        <button className="text-action" type="button" disabled={cooldown > 0} onClick={() => void sendEmailCode()}>
          {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
        </button>
        <p className="auth-switch"><Link href="/entrar">Voltar</Link></p>
      </form>
    );
  }
  if (method === null) return <p className="mfa-help" role="status">Verificando…</p>;

  return mode === "code" ? (
    <form className="auth-form" onSubmit={verify} noValidate>
      <p className="eyebrow">Verificação em duas etapas</p>
      <h1>Digite o código do aplicativo</h1>
      <p className="mfa-help">Abra o aplicativo autenticador e digite os 6 números do north.</p>
      <label className="auth-field">
        <span>Código</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" autoFocus />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" type="submit" disabled={sending}>{sending ? "Verificando…" : "Verificar"}</button>
      <button className="text-action" type="button" onClick={() => { setMode("recovery"); setError(""); }}>Perdi o acesso ao aplicativo</button>
      <p className="auth-switch"><Link href="/entrar">Voltar</Link></p>
    </form>
  ) : (
    <form className="auth-form" onSubmit={recover} noValidate>
      <p className="eyebrow">Recuperar acesso</p>
      <h1>Use um código de recuperação</h1>
      <p className="mfa-help">Digite um dos códigos que você guardou ao ativar a verificação (como ABCDE-12345). Ele desliga a verificação em duas etapas, e você pode ativar de novo no Perfil.</p>
      <label className="auth-field">
        <span>Código de recuperação</span>
        <input name="recovery" autoComplete="off" autoCapitalize="characters" placeholder="ABCDE-12345" autoFocus />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" type="submit" disabled={sending}>{sending ? "Verificando…" : "Recuperar acesso"}</button>
      <button className="text-action" type="button" onClick={() => { setMode("code"); setError(""); }}>Voltar para o código do aplicativo</button>
    </form>
  );
}
