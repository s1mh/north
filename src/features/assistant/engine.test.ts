import { describe, expect, it } from "vitest";
import { deriveAssistantInsights, deterministicAssistantReply } from "@/features/assistant/engine";
import type { AssistantContext } from "@/features/assistant/types";

export const assistantContextFixture: AssistantContext = {
  profile: {
    label: "Moderado",
    targetAllocation: {
      "Renda Fixa": 40,
      "Ações · ETF": 25,
      FIIs: 15,
      Internacional: 10,
      Cripto: 10,
    },
  },
  portfolio: {
    totalCents: "10000000",
    allocation: {
      "Renda Fixa": 31,
      "Ações · ETF": 25,
      FIIs: 15,
      Internacional: 9,
      Cripto: 20,
    },
  },
  goal: {
    remainingCents: "2500000",
    requiredMonthlyCents: "147059",
    plannedMonthlyCents: "80000",
    plannedGapCents: "67059",
  },
  market: [{
    code: "selic_target",
    label: "Selic",
    value: "10.5",
    unit: "percent_year",
    observedOn: "2026-07-30",
    stale: false,
    source: "Banco Central do Brasil",
  }],
};

describe("assistant deterministic engine", () => {
  it("derives only signals supported by known context", () => {
    const insights = deriveAssistantInsights(assistantContextFixture);
    expect(insights.map((item) => item.kind)).toEqual(["allocation", "goal", "market"]);
    expect(insights[0]?.title).toContain("10%");
  });

  it("explains allocation without issuing a trade order", () => {
    const reply = deterministicAssistantReply("Como está minha carteira?", assistantContextFixture);
    expect(reply.title).toContain("Cripto");
    expect(reply.paragraphs.join(" ")).toContain("não uma ordem");
  });

  it("uses the recorded goal amounts without assuming return", () => {
    const reply = deterministicAssistantReply("Estou no ritmo da minha meta?", assistantContextFixture);
    expect(reply.title).toContain("R$ 670,59");
    expect(reply.paragraphs.join(" ")).toContain("não inclui retorno");
  });

  it("does not invent unavailable market data", () => {
    const reply = deterministicAssistantReply("Como está a Selic?", {
      ...assistantContextFixture,
      market: [],
    });
    expect(reply.title).toContain("ainda não estão disponíveis");
  });

  it("redirects asset-picking requests to an educational simulation", () => {
    const reply = deterministicAssistantReply("Qual ativo eu compro?", assistantContextFixture);
    expect(reply.title).toContain("não escolher um ativo");
    expect(reply.actions).toContainEqual({ label: "Abrir no Investir", href: "/investir" });
  });
});
