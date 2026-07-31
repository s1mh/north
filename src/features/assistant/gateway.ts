import {
  classifyQuestionSafety,
  isAssistantReplyInScope,
} from "@/features/assistant/policy";
import { deterministicAssistantReply } from "@/features/assistant/engine";
import { attachServerDisclaimer } from "@/features/assistant/schemas";
import type { AssistantContext, AssistantReplyCore } from "@/features/assistant/types";

export type AssistantProvider = {
  model: string;
  generate(input: {
    question: string;
    context: AssistantContext;
    promptVersion: string;
    userRef: string;
  }): Promise<unknown>;
};

export const ASSISTANT_PROMPT_VERSION = "north-financial-scope-2026-07-31";

const blockedReply: AssistantReplyCore = {
  eyebrow: "Escopo do North",
  title: "Esse pedido não faz parte do North.",
  paragraphs: [
    "O assistente responde somente sobre sua carteira, metas, indicadores, produtos e simulações registradas no aplicativo.",
  ],
  facts: [],
  actions: [],
};

const outOfScopeReply: AssistantReplyCore = {
  eyebrow: "Escopo do North",
  title: "Vamos manter o foco nas suas finanças.",
  paragraphs: [
    "Pergunte sobre sua carteira, metas, indicadores, produtos ou simulações registradas no North.",
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
  userRef = "anonymous",
  timeoutMs = 4_000,
}: {
  question: string;
  context: AssistantContext;
  provider?: AssistantProvider;
  userRef?: string;
  timeoutMs?: number;
}) {
  const safety = classifyQuestionSafety(question);
  if (safety === "blocked") {
    return {
      reply: attachServerDisclaimer(blockedReply),
      status: "blocked" as const,
      model: "policy-v1",
    };
  }
  if (safety === "out_of_scope") {
    return {
      reply: attachServerDisclaimer(outOfScopeReply),
      status: "blocked" as const,
      model: "scope-policy-v1",
    };
  }

  if (provider) {
    try {
      const candidate = await withTimeout(provider.generate({
        question,
        context,
        promptVersion: ASSISTANT_PROMPT_VERSION,
        userRef,
      }), timeoutMs);
      const reply = attachServerDisclaimer(candidate);
      if (!isAssistantReplyInScope(reply)) throw new Error("provider left financial scope");
      return {
        reply,
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
