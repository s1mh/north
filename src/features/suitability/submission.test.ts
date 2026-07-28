import { describe, expect, it } from "vitest";
import { suitabilitySubmissionSchema } from "./submission";

describe("suitabilitySubmissionSchema", () => {
  it("aceita somente o mapa de respostas", () => {
    expect(suitabilitySubmissionSchema.safeParse({
      answers: { objetivo: "equilibrar" },
    }).success).toBe(true);
  });

  it("rejeita campos calculados pelo navegador", () => {
    expect(suitabilitySubmissionSchema.safeParse({
      answers: { objetivo: "equilibrar" },
      score: 100,
      profile: "arrojado",
    }).success).toBe(false);
  });
});
