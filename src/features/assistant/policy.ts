import { z } from "zod";

export const ASSISTANT_DISCLAIMER =
  "Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado.";

export const assistantQuestionSchema = z.object({
  threadId: z.uuid().nullable(),
  message: z.string().trim().min(2).max(500),
}).strict();

const sensitivePatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/g,
];

const injectionPatterns = [
  /ignore (?:todas? )?(?:as )?instru/i,
  /desconsidere (?:todas? )?(?:as )?instru/i,
  /prompt (?:do )?sistema/i,
  /system prompt/i,
  /revele? (?:a |o )?(?:chave|token|segredo|instruç)/i,
  /mostre? (?:a |o )?(?:chave|token|segredo|instruç)/i,
  /https?:\/\//i,
];

export function redactSensitiveText(value: string) {
  return sensitivePatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[dado removido]"),
    value,
  );
}

export function classifyQuestionSafety(value: string) {
  return injectionPatterns.some((pattern) => pattern.test(value))
    ? "blocked"
    : "allowed";
}
