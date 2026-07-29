import { notFound } from "next/navigation";
import { CorrectTransactionForm } from "@/features/portfolio/correct-transaction-form";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function CorrectTransactionPage({
  params,
}: {
  params: Promise<{ instrumentId: string; transactionId: string }>;
}) {
  const { instrumentId, transactionId } = await params;
  const supabase = await createClient();
  const [{ data: instrument }, { data: transaction }] = await Promise.all([
    supabase.from("portfolio_instruments").select("id, symbol, name").eq("id", instrumentId).maybeSingle(),
    supabase
      .from("portfolio_transactions")
      .select("id, instrument_id, transaction_type, quantity, unit_price, fees, cash_amount, trade_date, reverses_transaction_id")
      .eq("id", transactionId)
      .eq("instrument_id", instrumentId)
      .maybeSingle(),
  ]);

  if (!instrument || !transaction || transaction.reverses_transaction_id) notFound();

  return <main className="onboarding-shell">
    <CorrectTransactionForm
      instrument={instrument}
      transaction={transaction as Parameters<typeof CorrectTransactionForm>[0]["transaction"]}
    />
  </main>;
}
