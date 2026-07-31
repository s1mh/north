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

const outOfScopePatterns = [
  /\b(?:sql|javascript|typescript|python|programa(?:r|ção)|código fonte|banco de dados)\b/i,
  /\b(?:delete\s+from|drop\s+table|truncate\s+table|select\s+.+\s+from)\b/i,
  /\b(?:futebol|poema|receita|filme|música|jogo|esporte)\b/i,
  /\b(?:treinad[oa]|modelo de linguagem|llm|openai|anthropic|claude|gpt)\b/i,
];

const financialScopePatterns = [
  /\b(?:carteira|aloca(?:ção|r)|rebalancear|patrimônio|ativo|posição)\b/i,
  /\b(?:meta|objetivo|prazo|aporte|planejamento|simulação)\b/i,
  /\b(?:selic|ipca|cdi|ibovespa|inflação|juros?|mercado)\b/i,
  /\b(?:investir|investimento|renda fixa|ações?|etf|fii|tesouro|cdb|cripto)\b/i,
  /\b(?:risco|liquidez|rentabilidade|retorno|diversifica(?:ção|r)|perfil)\b/i,
  /\b(?:dinheiro|finanças?|orçamento|reserva|dívida|poupança)\b/i,
];

const forbiddenReplyPatterns = [
  ...outOfScopePatterns,
  /\b(?:prompt do sistema|instruções internas)\b/i,
];

export function redactSensitiveText(value: string) {
  return sensitivePatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[dado removido]"),
    value,
  );
}

export function classifyQuestionSafety(value: string) {
  if (injectionPatterns.some((pattern) => pattern.test(value))) return "blocked";
  if (outOfScopePatterns.some((pattern) => pattern.test(value))) return "out_of_scope";
  return financialScopePatterns.some((pattern) => pattern.test(value))
    ? "allowed"
    : "out_of_scope";
}

export function isAssistantReplyInScope(value: unknown) {
  const text = JSON.stringify(value);
  return !forbiddenReplyPatterns.some((pattern) => pattern.test(text));
}
