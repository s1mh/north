import { NextResponse } from "next/server";
import { z } from "zod";
import { describeAction, type ActionKind } from "@/features/assistant/actions";
import { ActionError, executeAction, undoAction } from "@/server/assistant/actions";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

const bodySchema = z.object({ decision: z.enum(["confirm", "cancel", "undo"]) }).strict();

type Transition = { id: string; kind: ActionKind; status: string; payload: unknown; result: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Origem inválida.", 403);
  const actionId = z.uuid().safeParse((await params).actionId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!actionId.success || !body.success) return fail("Pedido inválido.", 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Sessão inválida.", 401);

  const transition = async (from: string, to: string, result?: unknown) => {
    const { data, error } = await supabase.rpc("transition_assistant_action", {
      p_action_id: actionId.data,
      p_from: from,
      p_to: to,
      p_result: result ?? null,
    });
    if (error || !data) return null;
    return data as Transition;
  };
  const respond = (row: Transition, extra?: { error?: string }) => NextResponse.json(
    { id: row.id, status: row.status, view: describeAction(row.kind, row.payload), ...extra },
    { headers: privateHeaders },
  );

  if (body.data.decision === "cancel") {
    const row = await transition("proposed", "cancelled");
    return row ? respond(row) : fail("Essa proposta não está mais disponível.", 409);
  }

  if (body.data.decision === "confirm") {
    const claimed = await transition("proposed", "confirming");
    if (!claimed) return fail("Essa proposta venceu ou já foi respondida.", 409);
    try {
      const result = await executeAction(supabase, claimed.kind, claimed.payload);
      const done = await transition("confirming", "confirmed", result);
      return done ? respond(done) : fail("O registro foi feito, mas não consegui atualizar o status.", 500);
    } catch (failure) {
      const message = failure instanceof ActionError ? failure.message : "Não foi possível registrar agora.";
      const failed = await transition("confirming", "failed", { error: message });
      return failed ? respond(failed, { error: message }) : fail(message, 500);
    }
  }

  const undoing = await transition("confirmed", "undoing");
  if (!undoing) return fail("Não é possível desfazer esse registro.", 409);
  try {
    await undoAction(supabase, undoing.kind, undoing.result);
    const undone = await transition("undoing", "undone");
    return undone ? respond(undone) : fail("Desfeito, mas não consegui atualizar o status.", 500);
  } catch (failure) {
    const message = failure instanceof ActionError ? failure.message : "Não foi possível desfazer agora.";
    const back = await transition("undoing", "confirmed");
    return back ? respond(back, { error: message }) : fail(message, 500);
  }
}
