import { NextResponse } from "next/server";
import {
  portfolioCorrectionSchema,
  portfolioReversalSchema,
} from "@/features/portfolio/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(code?: string) {
  const dependent = code === "22003";
  const unavailable = code === "42501";
  return NextResponse.json(
    {
      error: dependent
        ? "Existem movimentações posteriores que dependem deste lançamento."
        : unavailable
          ? "Movimentação não encontrada ou já corrigida."
          : "Não foi possível concluir a alteração agora.",
    },
    { status: dependent ? 422 : unavailable ? 404 : 500, headers: privateHeaders },
  );
}

async function authenticatedClient(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function PATCH(request: Request) {
  const supabase = await authenticatedClient(request);
  if (!supabase) {
    return NextResponse.json({ error: "Sessão ou origem inválida." }, { status: 401, headers: privateHeaders });
  }

  const input = await request.json().catch(() => null);
  const parsed = portfolioCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados da correção." }, { status: 400, headers: privateHeaders });
  }

  const { data, error } = await supabase.rpc("correct_portfolio_transaction", {
    p_transaction_id: parsed.data.transactionId,
    p_transaction_type: parsed.data.transactionType,
    p_quantity: parsed.data.quantity,
    p_unit_price: parsed.data.unitPrice,
    p_fees: parsed.data.fees,
    p_cash_amount: parsed.data.cashAmount,
    p_trade_date: parsed.data.tradeDate,
    p_reason: parsed.data.reason,
  });

  if (error) return errorResponse(error.code);
  return NextResponse.json({ id: data }, { headers: privateHeaders });
}

export async function DELETE(request: Request) {
  const supabase = await authenticatedClient(request);
  if (!supabase) {
    return NextResponse.json({ error: "Sessão ou origem inválida." }, { status: 401, headers: privateHeaders });
  }

  const input = await request.json().catch(() => null);
  const parsed = portfolioReversalSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe o motivo do estorno." }, { status: 400, headers: privateHeaders });
  }

  const { data, error } = await supabase.rpc("reverse_portfolio_transaction", {
    p_transaction_id: parsed.data.transactionId,
    p_reason: parsed.data.reason,
  });

  if (error) return errorResponse(error.code);
  return NextResponse.json({ id: data }, { headers: privateHeaders });
}
