import type { Metadata } from "next";
import {
  SuitabilityFlow,
  type SuitabilityResult,
} from "@/features/suitability/suitability-flow";
import { createClient } from "@/server/supabase/client";

export const metadata: Metadata = {
  title: "Seu perfil",
  description: "Descubra seu perfil de investidor com o questionário do North.",
};

export const dynamic = "force-dynamic";

export default async function SuitabilityPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_assessment_id")
    .single();

  let initialResult: SuitabilityResult | null = null;
  if (profile?.current_assessment_id) {
    const { data: assessment } = await supabase
      .from("suitability_assessments")
      .select("score, profile")
      .eq("id", profile.current_assessment_id)
      .single();
    if (assessment) {
      initialResult = {
        score: assessment.score,
        profile: assessment.profile as SuitabilityResult["profile"],
      };
    }
  }

  return <SuitabilityFlow initialResult={initialResult} />;
}
