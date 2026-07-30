import { NextResponse } from "next/server";
import { assistantQuestionSchema, redactSensitiveText } from "@/features/assistant/policy";
import { ASSISTANT_PROMPT_VERSION, runAssistantGateway } from "@/server/assistant/gateway";
import { loadAssistantContext } from "@/server/assistant/context";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Origem inválida." },
      { status: 403, headers: privateHeaders },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sessão inválida." },
      { status: 401, headers: privateHeaders },
    );
  }

  const input = await request.json().catch(() => null);
  const parsed = assistantQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Escreva uma pergunta entre 2 e 500 caracteres." },
      { status: 400, headers: privateHeaders },
    );
  }

  const redactedMessage = redactSensitiveText(parsed.data.message);
  const { context, sourceRefs, contextHash } = await loadAssistantContext(supabase);
  const generation = await runAssistantGateway({
    question: redactedMessage,
    context,
  });
  const title = redactedMessage.slice(0, 80);
  const { data: threadId, error } = await supabase.rpc("save_assistant_exchange", {
    p_thread_id: parsed.data.threadId,
    p_title: title,
    p_user_content: redactedMessage,
    p_assistant_payload: generation.reply,
    p_status: generation.status,
    p_model: generation.model,
    p_prompt_version: ASSISTANT_PROMPT_VERSION,
    p_context_hash: contextHash,
    p_source_refs: sourceRefs,
  });
  if (error) {
    const rateLimited = error.message.includes("assistant rate limit");
    const unavailableThread = error.code === "42501";
    return NextResponse.json(
      {
        error: rateLimited
          ? "Você atingiu o limite de 20 perguntas por hora. Tente novamente mais tarde."
          : unavailableThread
            ? "Essa conversa não está mais disponível."
            : "Não foi possível responder agora.",
      },
      {
        status: rateLimited ? 429 : unavailableThread ? 404 : 500,
        headers: privateHeaders,
      },
    );
  }

  return NextResponse.json(
    { threadId, userMessage: redactedMessage, reply: generation.reply },
    { status: 201, headers: privateHeaders },
  );
}
