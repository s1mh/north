"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { destinationAfterSignIn, needsSecondFactor } from "@/features/auth/after-sign-in";

export function MfaChallengeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"code" | "recovery">("code");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/entrar"); return; }
      if (!(await needsSecondFactor(supabase))) router.replace(await destinationAfterSignIn(supabase));
    })();
  }, [router]);

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
