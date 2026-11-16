"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Enrolling = { factorId: string; qr: string; secret: string };
type State =
  | { step: "loading" }
  | { step: "off" }
  | { step: "enrolling"; data: Enrolling }
  | { step: "on"; factorId: string }
  | { step: "codes"; codes: string[]; factorId: string };

export function MfaSettings() {
  const supabase = createClient();
  const params = useSearchParams();
  const [state, setState] = useState<State>({ step: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.[0];
    setState(verified ? { step: "on", factorId: verified.id } : { step: "off" });
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function start() {
    setError(""); setBusy(true);
    try {
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const stale of ((all?.all ?? []) as Array<{ id: string; status: string }>).filter((factor) => factor.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `north. ${new Date().toISOString().slice(0, 16)}`,
      });
      if (enrollError || !data) throw enrollError ?? new Error("enroll");
      setState({ step: "enrolling", data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } });
    } catch {
      setError("Não foi possível iniciar agora. Tente de novo em instantes.");
    } finally { setBusy(false); }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>, factorId: string) {
    event.preventDefault();
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) { setError("Digite os 6 números do aplicativo."); return; }
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw challengeError ?? new Error("challenge");
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      const { data: codes, error: codesError } = await supabase.rpc("generate_mfa_recovery_codes");
      if (codesError || !Array.isArray(codes)) throw codesError ?? new Error("codes");
      setSaved(false);
      setState({ step: "codes", codes: codes as string[], factorId });
    } catch {
      setError("Código incorreto ou expirado. Confira o aplicativo e tente de novo.");
    } finally { setBusy(false); }
  }

  async function regenerate(factorId: string) {
    setError(""); setBusy(true);
    try {
      const { data: codes, error: codesError } = await supabase.rpc("generate_mfa_recovery_codes");
      if (codesError || !Array.isArray(codes)) throw codesError ?? new Error("codes");
      setSaved(false);
      setState({ step: "codes", codes: codes as string[], factorId });
    } catch {
      setError("Não foi possível gerar novos códigos. Entre de novo com o código do aplicativo e tente outra vez.");
    } finally { setBusy(false); }
  }

  async function disable(factorId: string) {
    if (!window.confirm("Desligar a verificação em duas etapas? A sua conta passa a depender só da senha.")) return;
    setError(""); setBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      await supabase.auth.refreshSession();
      setState({ step: "off" });
    } catch {
      setError("Não foi possível desligar agora. Entre de novo com o código do aplicativo e tente outra vez.");
    } finally { setBusy(false); }
  }

  async function cancel(factorId: string) {
    await supabase.auth.mfa.unenroll({ factorId });
    setState({ step: "off" });
  }

  function download(codes: string[]) {
    const blob = new Blob([`Códigos de recuperação do north.\nCada código vale uma vez.\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "north-codigos-de-recuperacao.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section className="mfa-card" aria-labelledby="mfa-title">
    <p className="eyebrow">Segurança</p>
    <h2 id="mfa-title">Verificação em duas etapas</h2>
    {params.get("mfa") === "reativar" && state.step === "off" && <p className="mfa-notice">Você entrou com um código de recuperação e a verificação foi desligada. Ative de novo abaixo.</p>}

    {state.step === "loading" && <p className="mfa-help">Carregando…</p>}

    {state.step === "off" && <>
      <p className="mfa-help">Além da senha, o north. pede um código de 6 números gerado por um aplicativo no seu celular (Google Authenticator, Microsoft Authenticator, Authy, 1Password e outros). É a forma mais simples de proteger a sua conta.</p>
      <button className="button" type="button" disabled={busy} onClick={start}>{busy ? "Preparando…" : "Ativar"}</button>
    </>}

    {state.step === "enrolling" && <form onSubmit={(event) => confirm(event, state.data.factorId)} noValidate>
      <ol className="mfa-steps">
        <li>Abra o seu aplicativo autenticador e escolha adicionar uma conta.</li>
        <li>Aponte a câmera para o código abaixo. Se não der, digite a chave manualmente.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mfa-qr" src={state.data.qr} alt="Código QR para o aplicativo autenticador" width={180} height={180} />
      <p className="mfa-secret">Chave manual: <code>{state.data.secret}</code></p>
      <label className="auth-field">
        <span>Código de 6 números do aplicativo</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" />
      </label>
      <div className="mfa-actions">
        <button className="button" type="submit" disabled={busy}>{busy ? "Verificando…" : "Confirmar e ativar"}</button>
        <button className="text-action" type="button" onClick={() => cancel(state.data.factorId)}>Cancelar</button>
      </div>
    </form>}

    {state.step === "codes" && <>
      <p className="mfa-help"><b>Verificação ativada.</b> Guarde estes códigos de recuperação em um lugar seguro. Se você perder o celular, cada código deixa você entrar uma vez. <b>Eles não aparecem de novo.</b></p>
      <ul className="mfa-codes">{state.codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
      <div className="mfa-actions">
        <button className="button" type="button" onClick={() => { void navigator.clipboard?.writeText(state.codes.join("\n")); }}>Copiar</button>
        <button className="button" type="button" onClick={() => download(state.codes)}>Baixar arquivo</button>
      </div>
      <label className="mfa-check"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> Guardei os códigos em um lugar seguro</label>
      <button className="button" type="button" disabled={!saved} onClick={() => setState({ step: "on", factorId: state.factorId })}>Concluir</button>
    </>}

    {state.step === "on" && <>
      <p className="mfa-help"><b>Ativada.</b> Ao entrar, o north. pede o código do aplicativo.</p>
      <div className="mfa-actions">
        <button className="button" type="button" disabled={busy} onClick={() => regenerate(state.factorId)}>Gerar novos códigos de recuperação</button>
        <button className="text-action" type="button" disabled={busy} onClick={() => disable(state.factorId)}>Desligar</button>
      </div>
    </>}

    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
