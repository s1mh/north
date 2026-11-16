import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAssetPayloadSchema,
  goalContributionPayloadSchema,
  recordTransactionPayloadSchema,
  type ActionKind,
} from "@/features/assistant/actions";

type Result = Record<string, unknown>;

export class ActionError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

function friendly(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === "22003") throw new ActionError("Isso deixaria a posição negativa nessa data.", error.code);
  if (error?.code === "23505") throw new ActionError("Esse ativo já existe nessa instituição.", error.code);
  if (error?.code === "42501") throw new ActionError("Esse item não está disponível.", error.code);
  throw new ActionError(fallback, error?.code);
}

/** Grava de verdade, pelas mesmas funções das telas (RLS e 2FA valem aqui também). */
export async function executeAction(
  supabase: SupabaseClient,
  kind: ActionKind,
  payload: unknown,
): Promise<Result> {
  if (kind === "record_transaction") {
    const parsed = recordTransactionPayloadSchema.parse(payload);
    const { data, error } = await supabase.rpc("record_portfolio_transaction", {
      p_instrument_id: parsed.data.instrumentId,
      p_transaction_type: parsed.data.transactionType,
      p_quantity: parsed.data.quantity,
      p_unit_price: parsed.data.unitPrice,
      p_fees: parsed.data.fees,
      p_cash_amount: parsed.data.cashAmount,
      p_trade_date: parsed.data.tradeDate,
    });
    if (error || !data) friendly(error, "Não foi possível registrar agora.");
    return { transactionIds: [data as string] };
  }

  if (kind === "create_asset") {
    const parsed = createAssetPayloadSchema.parse(payload);
    const { data, error } = await supabase.rpc("create_portfolio_asset", {
      p_institution_name: parsed.data.institutionName,
      p_symbol: parsed.data.symbol,
      p_name: parsed.data.name,
      p_asset_class: parsed.data.assetClass,
      p_quantity: parsed.data.quantity,
      p_unit_price: parsed.data.unitPrice,
      p_fees: parsed.data.fees,
      p_trade_date: parsed.data.tradeDate,
    });
    if (error || !data) friendly(error, "Não foi possível criar o ativo agora.");
    const { data: transactions } = await supabase
      .from("portfolio_transactions")
      .select("id")
      .eq("instrument_id", data as string);
    return {
      instrumentId: data as string,
      transactionIds: (transactions ?? []).map((row) => (row as { id: string }).id),
    };
  }

  const parsed = goalContributionPayloadSchema.parse(payload);
  const { data, error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: parsed.data.goalId,
    p_amount: parsed.data.amount,
    p_contributed_on: parsed.data.contributedOn,
    p_note: parsed.data.note,
  });
  if (error || !data) friendly(error, "Não foi possível registrar o aporte agora.");
  return { contributionId: data as string };
}

const UNDO_REASON = "Desfeito pelo assistente";

/** Desfaz usando os estornos que já existem (o histórico original continua visível). */
export async function undoAction(
  supabase: SupabaseClient,
  kind: ActionKind,
  result: unknown,
): Promise<void> {
  const value = (result ?? {}) as { transactionIds?: string[]; contributionId?: string };
  if (kind === "goal_contribution") {
    if (!value.contributionId) throw new ActionError("Não há o que desfazer.");
    const { error } = await supabase.rpc("reverse_goal_contribution", {
      p_contribution_id: value.contributionId,
      p_reason: UNDO_REASON,
    });
    if (error) friendly(error, "Não foi possível desfazer agora.");
    return;
  }
  const ids = value.transactionIds ?? [];
  if (ids.length === 0) throw new ActionError("Não há o que desfazer.");
  for (const id of ids) {
    const { error } = await supabase.rpc("reverse_portfolio_transaction", {
      p_transaction_id: id,
      p_reason: UNDO_REASON,
    });
    if (error) friendly(error, "Não foi possível desfazer agora.");
  }
}
