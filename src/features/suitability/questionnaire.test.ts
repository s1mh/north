import { describe, expect, it } from "vitest";
import {
  scoreAnswers,
  suitabilityQuestions,
  targetAllocationRecord,
  targetAllocations,
} from "./questionnaire";

function answersAt(optionIndex: number) {
  return Object.fromEntries(
    suitabilityQuestions.map((question) => [
      question.id,
      question.options[Math.min(optionIndex, question.options.length - 1)]!.id,
    ]),
  );
}

describe("scoreAnswers", () => {
  it("classifica o menor risco como conservador", () => {
    expect(scoreAnswers(answersAt(0))).toEqual({ score: 0, profile: "conservador" });
  });

  it("classifica respostas intermediárias como moderado", () => {
    expect(scoreAnswers(answersAt(1)).profile).toBe("moderado");
  });

  it("classifica o maior risco como arrojado", () => {
    expect(scoreAnswers(answersAt(99))).toEqual({ score: 100, profile: "arrojado" });
  });

  it("rejeita questionário incompleto", () => {
    expect(() => scoreAnswers({})).toThrow("Responda todas as perguntas");
  });

  it.each(Object.entries(targetAllocations))("mantém a alocação de %s em 100%%", (_, allocation) => {
    expect(allocation.reduce((total, item) => total + item.value, 0)).toBe(100);
  });

  it("serializa a alocação moderada sem tokens visuais", () => {
    expect(targetAllocationRecord("moderado")).toEqual({
      "Renda Fixa": 40,
      "Ações · ETF": 25,
      FIIs: 15,
      Internacional: 10,
      Cripto: 10,
    });
  });
});
