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
import { containsLeak, LeakError, streamAssistantAgent } from "@/server/assistant/agent";
import { loadAssistantContext } from "@/server/assistant/context";
import { hasVercelAiGatewayCredentials } from "@/server/assistant/vercel-provider";
import { createClient } from "@/server/supabase/client";

export const maxDuration = 60;

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: privateHeaders });

const guardedText = "Isso eu não consigo compartilhar, mas posso ajudar com a sua carteira, metas, indicadores e registros. O que você quer fazer?";
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

  const encoder = new TextEncoder();
  const userRef = createHash("sha256").update(user.id).digest("hex");

  // Resposta em fluxo: uma linha JSON por evento (status, trecho de texto, fim).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { /* conexão fechada */ }
      };
      try {
        let text = "";
        let status: "generated" | "fallback" | "blocked" = "generated";
        let model = "policy-v1";
        let actionIds: string[] = [];

        if (classifyQuestionSafety(message) === "blocked") {
          text = blockedText;
          status = "blocked";
          send({ t: "delta", text });
        } else if (hasVercelAiGatewayCredentials()) {
          try {
            const result = await streamAssistantAgent({
              supabase,
              history,
              question: message,
              userRef,
              onStatus: (value) => send({ t: "status", text: value }),
              onDelta: (delta) => send({ t: "delta", text: delta }),
              onReset: () => send({ t: "reset" }),
            });
            if (!result.text) throw new Error("empty");
            if (!isAssistantReplyInScope(result.text) || containsLeak(result.text)) throw new LeakError("guard");
            text = result.text.slice(0, 1900);
            model = result.model;
            actionIds = result.actionIds;
          } catch (failure) {
            if (failure instanceof LeakError) {
              // Resposta barrada pela guarda: recusa clara, sem resumo aleatório.
              status = "blocked";
              text = guardedText;
              model = "policy-v1";
              actionIds = [];
              send({ t: "reset" });
              send({ t: "delta", text });
            } else {
              status = "fallback";
            }
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
          send({ t: "reset" });
          send({ t: "delta", text });
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
          send({
            t: "error",
            error: unavailable ? "Essa conversa não está mais disponível." : "Não foi possível responder agora.",
          });
          return;
        }
        const ids = saved as { thread_id: string; user_message_id: string; assistant_message_id: string };

        const { data: actionRows } = actionIds.length > 0
          ? await supabase.from("assistant_actions").select("id, kind, status, payload").in("id", actionIds)
          : { data: [] };
        const actions = ((actionRows ?? []) as Array<{
          id: string; kind: ActionKind; status: ActionStatus; payload: unknown;
        }>).map((row) => ({ id: row.id, kind: row.kind, status: row.status, view: describeAction(row.kind, row.payload) }));

        // "text" final substitui o que foi mostrado (cobre reset, fallback e descarte).
        send({
          t: "done",
          threadId: ids.thread_id,
          userMessage: message,
          assistantMessageId: ids.assistant_message_id,
          text,
          actions,
        });
      } catch {
        send({ t: "error", error: "Não foi possível responder agora." });
      } finally {
        try { controller.close(); } catch { /* já fechado */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...privateHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
