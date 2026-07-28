export type InvestorProfile = "conservador" | "moderado" | "arrojado";

export function profileForScore(score: number): InvestorProfile {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new RangeError("A pontuação deve ser um inteiro entre 0 e 100.");
  }
  if (score <= 35) return "conservador";
  if (score <= 70) return "moderado";
  return "arrojado";
}
