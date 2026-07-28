import { describe, expect, it } from "vitest";
import { profileForScore } from "./score";

describe("profileForScore", () => {
  it.each([[0, "conservador"], [35, "conservador"], [36, "moderado"], [70, "moderado"], [71, "arrojado"], [100, "arrojado"]] as const)("classifica %i como %s", (score, profile) => {
    expect(profileForScore(score)).toBe(profile);
  });

  it.each([-1, 101, 1.5, Number.NaN])("rejeita pontuação inválida %s", (score) => {
    expect(() => profileForScore(score)).toThrow(RangeError);
  });
});
