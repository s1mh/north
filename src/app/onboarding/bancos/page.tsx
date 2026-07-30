import type { Metadata } from "next";
import { BankSelection } from "@/features/onboarding/bank-selection";
import type { Institution, ResearchRequest } from "@/features/institutions/types";
import { createClient } from "@/server/supabase/client";

export const metadata: Metadata = { title: "Seus bancos" };

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const [{ data: institutions }, { data: selected }, { data: requests }, params] = await Promise.all([
    supabase
      .from("institutions")
      .select("id, slug, name, initial, color_token")
      .order("name"),
    supabase.from("user_institutions").select("institution_id"),
    supabase
      .from("institution_research_requests")
      .select("id, requested_name, status")
      .in("status", ["queued", "reviewing"])
      .order("created_at"),
    searchParams,
  ]);
  const nextPath = params.next === "/produtos" || params.next === "/perfil"
    ? params.next
    : "/onboarding/perfil";

  return <BankSelection
    institutions={(institutions ?? []) as Institution[]}
    initialSelected={(selected ?? []).map((row) => row.institution_id as string)}
    requests={(requests ?? []) as ResearchRequest[]}
    nextPath={nextPath}
  />;
}
