import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Suspense } from "react";
import { EmailMfaSettings } from "@/features/auth/email-mfa-settings";
import { MfaSettings } from "@/features/auth/mfa-settings";
import { CredentialSettings } from "@/features/profile/credential-settings";
import { AccountControls } from "@/features/profile/account-controls";
import type { ThemePreference } from "@/features/profile/theme";
import { ThemeControl } from "@/features/profile/theme-control";
import { profileInitials } from "@/features/profile/initials";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: profile }, { count: institutionCount }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("display_name, theme, current_assessment_id")
      .maybeSingle(),
    supabase
      .from("user_institutions")
      .select("*", { count: "exact", head: true }),
  ]);
  const assessmentId = profile?.current_assessment_id as string | null | undefined;
  const { data: assessment } = assessmentId
    ? await supabase
      .from("suitability_assessments")
      .select("profile")
      .eq("id", assessmentId)
      .maybeSingle()
    : { data: null };
  const theme = (
    profile?.theme === "light" || profile?.theme === "dark"
  ) ? profile.theme : "system";
  const profileLabel = typeof assessment?.profile === "string"
    ? assessment.profile
    : "não concluído";

  return <AppShell active="">
    <header className="pf-hero">
      <span className="pf-avatar" aria-hidden="true">{profileInitials(profile?.display_name)}</span>
      <div>
        <p className="eyebrow">Conta e ajustes</p>
        <h1>{profile?.display_name ?? "Seu perfil"}</h1>
        {user?.email && <p className="pf-email">{user.email}</p>}
      </div>
      <Link className="pf-investor" href="/onboarding/perfil">
        <span>Perfil de investidor</span>
        <strong>{profileLabel}</strong>
        <small>Refazer questionário →</small>
      </Link>
    </header>

    <div className="pf-grid">
      <div className="pf-col">
        <div className="pf-card"><ThemeControl initialTheme={theme as ThemePreference} /></div>

        <section className="pf-card profile-links" aria-labelledby="org-title">
          <p className="eyebrow">Organização</p>
          <h2 id="org-title" className="sr-only">Atalhos</h2>
          <Link href="/onboarding/bancos?next=/perfil">
            <span><strong>Bancos e corretoras</strong><small>{institutionCount ?? 0} vinculados</small></span>
            <b>›</b>
          </Link>
          <Link href="/produtos">
            <span><strong>Produtos revisados</strong><small>fontes e condições</small></span>
            <b>›</b>
          </Link>
          <Link href="/metas">
            <span><strong>Metas</strong><small>planos e aportes</small></span>
            <b>›</b>
          </Link>
        </section>

        <section className="pf-card profile-pwa">
          <p className="eyebrow">Aplicativo instalável</p>
          <h2>North no seu aparelho</h2>
          <p>Use “Adicionar à Tela de Início” no menu do navegador. Sem internet, o North não exibe cópias antigas dos seus dados.</p>
        </section>
      </div>

      <div className="pf-col">
        <div className="pf-card pf-security">
          {user?.email && <CredentialSettings currentEmail={user.email} />}
          <Suspense fallback={null}><EmailMfaSettings /><MfaSettings /></Suspense>
        </div>
        <div className="pf-card"><AccountControls /></div>
      </div>
    </div>
  </AppShell>;
}
