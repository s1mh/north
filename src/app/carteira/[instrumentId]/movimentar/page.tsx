import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AddTransactionForm, type AmountMode } from "@/features/portfolio/add-transaction-form";
import { derivePosition, type PortfolioTransaction } from "@/features/portfolio/ledger";
import { isBalanceProduct } from "@/features/portfolio/terms";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ instrumentId: string }>;
}) {
  const { instrumentId } = await params;
  const supabase = await createClient();
  const [{ data }, { data: terms }, { count: valuations }] = await Promise.all([
    supabase
      .from("portfolio_instruments")
      .select(`
        id, symbol, name, latest_price,
        portfolio_transactions(
          id, transaction_type, quantity, unit_price, fees, cash_amount,
          reverses_transaction_id, corrects_transaction_id, audit_reason,
          trade_date, created_at
        )
      `)
      .eq("id", instrumentId)
      .order("trade_date", { referencedTable: "portfolio_transactions", ascending: true })
      .order("created_at", { referencedTable: "portfolio_transactions", ascending: true })
      .maybeSingle(),
    supabase.from("portfolio_instrument_terms").select("product_type").eq("instrument_id", instrumentId).maybeSingle(),
    supabase.from("portfolio_valuations").select("id", { count: "exact", head: true }).eq("instrument_id", instrumentId),
  ]);

  if (!data) notFound();
  const instrument = data as unknown as {
    id: string; symbol: string; name: string; latest_price: string | number | null;
    portfolio_transactions: PortfolioTransaction[];
  };

  // Ativo de saldo, ou com valor informado: o preço atual não é 1,00 e o aporte vira "cotas".
  const useAmount = (isBalanceProduct((terms as { product_type?: string } | null)?.product_type)
    || (valuations ?? 0) > 0) && instrument.latest_price !== null;
  let amountMode: AmountMode | null = null;
  if (useAmount) {
    try {
      const position = derivePosition(instrument.portfolio_transactions, instrument.latest_price);
      amountMode = {
        price: String(instrument.latest_price),
        quantity: (Number(position.quantity) / 1e8).toFixed(8),
        value: Number(position.currentValueCents ?? position.costBasisCents) / 100,
      };
    } catch {
      amountMode = null;
    }
  }

  return <AppShell active="/carteira">
    <AddTransactionForm
      instrument={{ id: instrument.id, symbol: instrument.symbol, name: instrument.name }}
      amountMode={amountMode}
    />
  </AppShell>;
}
