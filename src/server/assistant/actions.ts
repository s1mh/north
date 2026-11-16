import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAssetPayloadSchema,
  createGoalPayloadSchema,
  goalContributionPayloadSchema,
  recordTransactionPayloadSchema,
  reverseTransactionPayloadSchema,
  setTermsPayloadSchema,
  updateValuationPayloadSchema,
  canUndo,
  type ActionKind,
} from "@/features/assistant/actions";

type Result = Record<string, unknown>;

export class ActionError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

function friendly(error: { code?: string; message?: string } | null, fallback: string): never {
  console.error("[assistant-action] failed", { code: error?.code, message: error?.message?.slice(0, 120) });
  if (error?.code === "23514") throw new ActionError("Alguns dados não combinam entre si. Revise e tente de novo.", error.code);
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

  if (kind === "update_valuation") {
    const parsed = updateValuationPayloadSchema.parse(payload);
    const { data, error } = await supabase.rpc("record_instrument_valuation", {
      p_instrument_id: parsed.data.instrumentId,
      p_total_value: parsed.data.totalValue,
      p_valued_on: parsed.data.valuedOn,
    });
    if (error || !data) friendly(error, "Não foi possível atualizar o valor agora.");
    const value = data as { previous_price: number | null; previous_observed_at: string | null };
    return {
      instrumentId: parsed.data.instrumentId,
      valuedOn: parsed.data.valuedOn,
      previousPrice: value.previous_price,
      previousObservedAt: value.previous_observed_at,
    };
  }

  if (kind === "set_terms") {
    const parsed = setTermsPayloadSchema.parse(payload);
    const { data, error } = await supabase.rpc("set_instrument_terms", {
      p_instrument_id: parsed.instrumentId,
      p_terms: parsed.terms,
    });
    if (error || !data) friendly(error, "Não foi possível salvar a ficha agora.");
    return { instrumentId: parsed.instrumentId, previous: (data as { previous: unknown }).previous ?? null };
  }

  if (kind === "reverse_transaction") {
    const parsed = reverseTransactionPayloadSchema.parse(payload);
    const { data, error } = await supabase.rpc("reverse_portfolio_transaction", {
      p_transaction_id: parsed.data.transactionId,
      p_reason: parsed.data.reason,
    });
    if (error || !data) friendly(error, "Não foi possível estornar agora.");
    return { reversalId: data as string };
  }

  if (kind === "create_goal") {
    const parsed = createGoalPayloadSchema.parse(payload);
    const { data, error } = await supabase.rpc("create_goal_with_plan", {
      p_name: parsed.data.name,
      p_kind: parsed.data.kind,
      p_target_amount: parsed.data.targetAmount,
      p_target_date: parsed.data.targetDate,
      p_planned_monthly_amount: parsed.data.plannedMonthlyAmount,
    });
    if (error || !data) friendly(error, "Não foi possível criar a meta agora.");
    return { goalId: data as string };
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
  if (!canUndo(kind)) throw new ActionError("Esse registro não pode ser desfeito por aqui.");
  if (kind === "update_valuation") {
    const value = (result ?? {}) as {
      instrumentId?: string; valuedOn?: string; previousPrice?: number | null; previousObservedAt?: string | null;
    };
    if (!value.instrumentId || !value.valuedOn || value.previousPrice == null) {
      throw new ActionError("Não há o que desfazer.");
    }
    const { error } = await supabase.rpc("restore_instrument_valuation", {
      p_instrument_id: value.instrumentId,
      p_valued_on: value.valuedOn,
      p_previous_price: value.previousPrice,
      p_previous_observed_at: value.previousObservedAt ?? null,
    });
    if (error) friendly(error, "Não foi possível desfazer agora.");
    return;
  }
  if (kind === "set_terms") {
    const value = (result ?? {}) as { instrumentId?: string; previous?: unknown };
    if (!value.instrumentId) throw new ActionError("Não há o que desfazer.");
    const { error } = await supabase.rpc("restore_instrument_terms", {
      p_instrument_id: value.instrumentId,
      p_previous: value.previous ?? null,
    });
    if (error) friendly(error, "Não foi possível desfazer agora.");
    return;
  }
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
