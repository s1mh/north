import { NextResponse } from "next/server";
import { portfolioTransactionSchema } from "@/features/portfolio/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers: privateHeaders });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: privateHeaders });
  }

  const input = await request.json().catch(() => null);
  const parsed = portfolioTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise os dados da movimentação." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("record_portfolio_transaction", {
    p_instrument_id: parsed.data.instrumentId,
    p_transaction_type: parsed.data.transactionType,
    p_quantity: parsed.data.quantity,
    p_unit_price: parsed.data.unitPrice,
    p_fees: parsed.data.fees,
    p_cash_amount: parsed.data.cashAmount,
    p_trade_date: parsed.data.tradeDate,
  });

  if (error) {
    const insufficient = error.code === "22003";
    const unavailable = error.code === "42501";
    return NextResponse.json(
      {
        error: insufficient
          ? "Essa movimentação deixaria a posição negativa."
          : unavailable
            ? "Ativo não encontrado."
            : "Não foi possível registrar a movimentação agora.",
      },
      { status: insufficient ? 422 : unavailable ? 404 : 500, headers: privateHeaders },
    );
  }

  return NextResponse.json({ id: data }, { status: 201, headers: privateHeaders });
}
