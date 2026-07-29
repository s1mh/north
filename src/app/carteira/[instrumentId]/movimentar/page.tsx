import { notFound } from "next/navigation";
import { AddTransactionForm } from "@/features/portfolio/add-transaction-form";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ instrumentId: string }>;
}) {
  const { instrumentId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_instruments")
    .select("id, symbol, name")
    .eq("id", instrumentId)
    .maybeSingle();

  if (!data) notFound();

  return <main className="onboarding-shell">
    <AddTransactionForm instrument={data} />
  </main>;
}
