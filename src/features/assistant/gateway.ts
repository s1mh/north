import { classifyQuestionSafety } from "@/features/assistant/policy";
import { deterministicAssistantReply } from "@/features/assistant/engine";
import { attachServerDisclaimer } from "@/features/assistant/schemas";
import type { AssistantContext, AssistantReplyCore } from "@/features/assistant/types";

export type AssistantProvider = {
  model: string;
  generate(input: {
    question: string;
    context: AssistantContext;
    promptVersion: string;
  }): Promise<unknown>;
};

export const ASSISTANT_PROMPT_VERSION = "north-educational-2026-07-30";

const blockedReply: AssistantReplyCore = {
  eyebrow: "Limite de segurança",
  title: "Posso ajudar com educação financeira, não com instruções internas.",
  paragraphs: [
    "Reformule a pergunta sem links, pedidos de segredos, tokens ou mudanças nas regras do North.",
  ],
  facts: [],
  actions: [],
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("provider timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runAssistantGateway({
  question,
  context,
  provider,
  timeoutMs = 4_000,
}: {
  question: string;
  context: AssistantContext;
  provider?: AssistantProvider;
  timeoutMs?: number;
}) {
  if (classifyQuestionSafety(question) === "blocked") {
    return {
      reply: attachServerDisclaimer(blockedReply),
      status: "blocked" as const,
      model: "policy-v1",
    };
  }

  if (provider) {
    try {
      const candidate = await withTimeout(provider.generate({
        question,
        context,
        promptVersion: ASSISTANT_PROMPT_VERSION,
      }), timeoutMs);
      return {
        reply: attachServerDisclaimer(candidate),
        status: "generated" as const,
        model: provider.model,
      };
    } catch {
      // A provider is optional and untrusted; deterministic output is the safe fallback.
    }
  }

  return {
    reply: attachServerDisclaimer(deterministicAssistantReply(question, context)),
    status: "fallback" as const,
    model: "deterministic-v1",
  };
}
