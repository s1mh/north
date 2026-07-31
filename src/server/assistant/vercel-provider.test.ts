import { describe, expect, it, vi } from "vitest";
import { assistantContextFixture } from "@/features/assistant/engine.test";
import {
  buildAssistantPrompt,
  FALLBACK_ASSISTANT_MODEL,
  hasVercelAiGatewayCredentials,
  PRIMARY_ASSISTANT_MODEL,
} from "@/server/assistant/vercel-provider";

vi.mock("server-only", () => ({}));

describe("Vercel assistant provider", () => {
  it("uses current, inexpensive models from two providers", () => {
    expect(PRIMARY_ASSISTANT_MODEL).toBe("openai/gpt-5.6-luna");
    expect(FALLBACK_ASSISTANT_MODEL).toBe("anthropic/claude-haiku-4.5");
  });

  it("keeps the prompt limited to the redacted question and validated context", () => {
    const prompt = JSON.parse(buildAssistantPrompt({
      question: "Como está minha carteira?",
      context: assistantContextFixture,
      promptVersion: "test-v1",
    })) as Record<string, unknown>;

    expect(prompt).toEqual({
      task: "Responda somente sobre finanças pessoais usando o contexto validado do North.",
      promptVersion: "test-v1",
      question: "Como está minha carteira?",
      context: assistantContextFixture,
    });
  });

  it("does not call the remote gateway in unconfigured local development", () => {
    expect(hasVercelAiGatewayCredentials({})).toBe(false);
    expect(hasVercelAiGatewayCredentials({ VERCEL: "1" })).toBe(true);
    expect(hasVercelAiGatewayCredentials({ AI_GATEWAY_API_KEY: "test" })).toBe(true);
  });
});
