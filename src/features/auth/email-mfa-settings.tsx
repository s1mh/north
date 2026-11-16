"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSecondFactorStatus } from "@/features/auth/after-sign-in";

type State = "loading" | "off" | "code" | "on" | "totp";

export function EmailMfaSettings() {
  const supabase = createClient();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    const status = await getSecondFactorStatus(supabase);
    setState(status.method === "totp" ? "totp" : status.method === "email" ? "on" : "off");
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);

  async function start() {
    setError(""); setInfo(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/email-2fa/send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "enable" }),
      });
      if (response.status === 429) throw new Error("Muitos pedidos. Tente de novo em 1 hora.");
      if (!response.ok) throw new Error("Não foi possível enviar o código agora.");
      setInfo("Enviamos um código de 6 números para o seu e-mail.");
      setState("code");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível enviar o código agora.");
    } finally { setBusy(false); }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) { setError("Digite os 6 números enviados para o seu e-mail."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/email-2fa/verify", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "enable", code }),
      });
      if (!response.ok) throw new Error("verify");
      setInfo("");
      setState("on");
    } catch {
      setError("Código incorreto ou expirado. Peça um novo e tente de novo.");
    } finally { setBusy(false); }
  }

  async function disable() {
    if (!window.confirm("Desligar o código por e-mail? A sua conta passa a depender só da senha.")) return;
    setError(""); setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("disable_email_2fa");
      if (rpcError) throw rpcError;
      setState("off");
    } catch {
      setError("Não foi possível desligar agora. Entre de novo com o código e tente outra vez.");
    } finally { setBusy(false); }
  }

  return <section className="mfa-card" aria-labelledby="email-mfa-title">
    <p className="eyebrow">Segurança · mais simples</p>
    <h2 id="email-mfa-title">Código por e-mail</h2>

    {state === "loading" && <p className="mfa-help">Carregando…</p>}

    {state === "off" && <>
      <p className="mfa-help">Ao entrar, o north. envia um código de 6 números para o seu e-mail. Mesmo que alguém descubra a sua senha, não entra sem o código. Não precisa instalar nada.</p>
      <button className="button" type="button" disabled={busy} onClick={start}>{busy ? "Enviando…" : "Ativar"}</button>
    </>}

    {state === "code" && <form onSubmit={confirm} noValidate>
      {info && <p className="mfa-help">{info}</p>}
      <label className="auth-field">
        <span>Código de 6 números</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" />
      </label>
      <div className="mfa-actions">
        <button className="button" type="submit" disabled={busy}>{busy ? "Verificando…" : "Confirmar e ativar"}</button>
        <button className="text-action" type="button" onClick={() => { setState("off"); setError(""); }}>Cancelar</button>
      </div>
    </form>}

    {state === "on" && <>
      <p className="mfa-help"><b>Ativado.</b> Ao entrar, o north. envia um código para o seu e-mail. Quem controla o seu e-mail consegue receber o código, então proteja bem a senha dele.</p>
      <div className="mfa-actions"><button className="text-action" type="button" disabled={busy} onClick={disable}>Desligar</button></div>
    </>}

    {state === "totp" && <p className="mfa-help">O aplicativo autenticador está ativo e tem prioridade. Para usar o código por e-mail, desligue o aplicativo abaixo.</p>}

    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
