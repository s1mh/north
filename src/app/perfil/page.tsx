import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import type { ThemePreference } from "@/features/profile/theme";
import { ThemeControl } from "@/features/profile/theme-control";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const [{ data: profile }, { count: institutionCount }] = await Promise.all([
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
    <div className="profile-heading">
      <p className="eyebrow">Conta e ajustes</p>
      <h1>{profile?.display_name ?? "Seu perfil"}</h1>
      <p>Preferências do aplicativo e caminhos para revisar seus dados.</p>
    </div>

    <section className="profile-summary">
      <div><span>Perfil de investidor</span><strong>{profileLabel}</strong></div>
      <Link href="/onboarding/perfil">Refazer questionário →</Link>
    </section>

    <ThemeControl initialTheme={theme as ThemePreference} />

    <section className="profile-links">
      <p className="eyebrow">Organização</p>
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

    <section className="profile-pwa">
      <p className="eyebrow">Aplicativo instalável</p>
      <h2>North no seu aparelho</h2>
      <p>Use “Adicionar à Tela de Início” no menu do navegador. Sem internet, o North não exibe cópias antigas dos seus dados.</p>
    </section>
  </AppShell>;
}
