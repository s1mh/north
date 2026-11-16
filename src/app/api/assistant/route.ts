import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { describeAction, type ActionKind, type ActionStatus } from "@/features/assistant/actions";
import {
  assistantQuestionSchema,
  classifyQuestionSafety,
  isAssistantReplyInScope,
  redactSensitiveText,
} from "@/features/assistant/policy";
import { deterministicAssistantReply } from "@/features/assistant/engine";
import { runAssistantAgent } from "@/server/assistant/agent";
import { loadAssistantContext } from "@/server/assistant/context";
import { hasVercelAiGatewayCredentials } from "@/server/assistant/vercel-provider";
import { createClient } from "@/server/supabase/client";

export const maxDuration = 60;

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

const blockedText = "Esse pedido não faz parte do north. Posso ajudar com a sua carteira, metas, indicadores e registros.";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return fail("Origem inválida.", 403);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Sessão inválida.", 401);

  const parsed = assistantQuestionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Escreva uma mensagem entre 2 e 500 caracteres.", 400);

  const message = redactSensitiveText(parsed.data.message);
  const { data: generationId, error: claimError } = await supabase.rpc("claim_assistant_turn", {
    p_input_chars: Array.from(message).length,
  });
  if (claimError || !generationId) {
    const rateLimited = claimError?.message.includes("assistant rate limit");
    return fail(
      rateLimited
        ? "Você atingiu o limite de 20 mensagens por hora. Tente novamente mais tarde."
        : "Não foi possível reservar esta mensagem agora.",
      rateLimited ? 429 : 500,
    );
  }

  // Memória da conversa: as últimas mensagens (só texto).
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (parsed.data.threadId) {
    const { data: rows } = await supabase
      .from("assistant_messages")
      .select("role, content")
      .eq("thread_id", parsed.data.threadId)
      .order("created_at", { ascending: false })
      .limit(10);
    history = ((rows ?? []) as Array<{ role: "user" | "assistant"; content: string }>).reverse();
  }

  let text = "";
  let status: "generated" | "fallback" | "blocked" = "generated";
  let model = "policy-v1";
  let actionIds: string[] = [];

  if (classifyQuestionSafety(message) === "blocked") {
    text = blockedText;
    status = "blocked";
  } else if (hasVercelAiGatewayCredentials()) {
    try {
      const result = await runAssistantAgent({
        supabase,
        history,
        question: message,
        userRef: createHash("sha256").update(user.id).digest("hex"),
      });
      if (!result.text || !isAssistantReplyInScope(result.text)) throw new Error("empty_or_out_of_scope");
      text = result.text.slice(0, 1900);
      model = result.model;
      actionIds = result.actionIds;
    } catch {
      status = "fallback";
    }
  } else {
    status = "fallback";
  }

  if (status === "fallback") {
    const { context } = await loadAssistantContext(supabase);
    const reply = deterministicAssistantReply(message, context);
    text = `Não consegui falar com o assistente completo agora, então segue um resumo:\n\n${reply.title}\n${reply.paragraphs.join("\n\n")}`.slice(0, 1900);
    model = "deterministic-v1";
    actionIds = [];
  } else if (status === "blocked") {
    model = "policy-v1";
  }

  const { data: saved, error: saveError } = await supabase.rpc("save_assistant_turn", {
    p_generation_id: generationId,
    p_thread_id: parsed.data.threadId,
    p_title: message.slice(0, 80),
    p_user_content: message,
    p_assistant_text: text,
    p_assistant_payload: { v: 2, text },
    p_status: status,
    p_model: model,
    p_action_ids: actionIds,
  });
  if (saveError || !saved) {
    const unavailable = saveError?.code === "42501";
    return fail(unavailable ? "Essa conversa não está mais disponível." : "Não foi possível responder agora.", unavailable ? 404 : 500);
  }
  const ids = saved as { thread_id: string; user_message_id: string; assistant_message_id: string };

  const { data: actionRows } = actionIds.length > 0
    ? await supabase.from("assistant_actions").select("id, kind, status, payload, result").in("id", actionIds)
    : { data: [] };
  const actions = ((actionRows ?? []) as Array<{
    id: string; kind: ActionKind; status: ActionStatus; payload: unknown; result: unknown;
  }>).map((row) => ({ id: row.id, kind: row.kind, status: row.status, view: describeAction(row.kind, row.payload) }));

  return NextResponse.json(
    {
      threadId: ids.thread_id,
      userMessage: message,
      assistantMessageId: ids.assistant_message_id,
      text,
      actions,
    },
    { status: 201, headers: privateHeaders },
  );
}
