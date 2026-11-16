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
  // pedir para ignorar/esquecer/substituir regras (PT e EN)
  /ignor\w* (?:todas? )?(?:as |suas |essas |tuas )?(?:instru|regras|diretrizes|ordens)/i,
  /desconsider\w* (?:todas? )?(?:as |suas |essas )?(?:instru|regras|diretrizes)/i,
  /esque[çc]\w* (?:tudo|todas? as|as suas|suas|as) (?:instru|regras|diretrizes|que|anterior)/i,
  /(?:novas?|nova) (?:instru[çc]|regras|ordens)/i,
  /ignore (?:all |any |the |your )?(?:previous|prior|above|earlier|system)/i,
  /disregard (?:all |any |the |your )?(?:previous|prior|above|system)/i,
  /forget (?:everything|all|your) (?:instructions|rules|above|previous)?/i,
  /override (?:your|the|all) (?:rules|instructions|safety|system)/i,
  // revelar prompt, ferramentas, chaves
  /prompt (?:do )?sistema/i,
  /system prompt/i,
  /(?:revele?|mostre?|exiba|imprima|repita|liste|vaze|diga|conte)\w* (?:a |o |as |os |seu |sua |tuas? |tuas? )?(?:chave|token|segredo|senha|instru[çc]|prompt|regras|ferramentas|configura)/i,
  /(?:reveal|show|print|repeat|leak|output|tell me) (?:me )?(?:your |the )?(?:system |hidden |initial |original )?(?:prompt|instructions|rules|tools|keys?|secrets?|api key)/i,
  /repita (?:tudo|o texto|a mensagem|as palavras) (?:acima|anterior|desde o in[ií]cio)/i,
  /(?:texto|mensagem|conte[úu]do) (?:acima|anterior) (?:desta|dessa|da) (?:conversa|mensagem)/i,
  // troca de papel / jailbreak
  /\b(?:modo|mode) (?:desenvolvedor|developer|deus|god|admin|root|dan|sem restri|irrestrito|jailbreak)/i,
  /\bjailbreak/i,
  /\bDAN\b/,
  /(?:voc[êe] agora [ée]|a partir de agora voc[êe]|you are now|act as|pretend (?:to be|you)|finja (?:que|ser)|aja como|se passe por|atue como)/i,
  /sem (?:nenhuma |qualquer )?(?:restri[çc][ãa]o|filtro|regra|limite)s?/i,
  // marcadores de formatação de sistema
  /<\|?(?:im_start|im_end|system|assistant|endoftext)\|?>/i,
  /\[\/?(?:INST|SYS|SYSTEM)\]/i,
  /^\s*(?:system|assistant|developer|sistema)\s*:/im,
  /```\s*(?:system|prompt)/i,
  // gravar sem confirmação / burlar o fluxo
  /(?:sem|n[ãa]o precisa(?:r)? (?:de )?|dispens\w*) (?:pedir )?confirma[çc][ãa]o/i,
  /(?:confirm\w*|execut\w*|grav\w*) (?:automaticamente|direto|sozinha?|por conta pr[óo]pria)/i,
  /bypass|burl(?:ar|e) (?:a )?(?:confirma|seguran|regra)/i,
  // dados de outras pessoas / infraestrutura
  /(?:dados|carteira|conta|saldo|metas?) (?:de|do|da) (?:outro|outra|outras|outros|demais|todos|qualquer) (?:usu[aá]rio|pessoa|cliente|conta)/i,
  /(?:outros|todos os|demais) usu[aá]rios/i,
  /(?:service[_ ]role|api[_ ]key|chave (?:de )?api|vari[aá]ve(?:l|is) de ambiente|\.env\b)/i,
  /\bbase64\b|\b[A-Za-z0-9+/]{60,}={0,2}\b/,
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
