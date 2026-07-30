import { formatMoneyFromCents } from "@/features/portfolio/ledger";
import type {
  AssistantContext,
  AssistantInsight,
  AssistantReplyCore,
} from "@/features/assistant/types";

const percentage = (value: number) => `${value.toLocaleString("pt-BR", {
  maximumFractionDigits: 1,
})}%`;

function money(value: string) {
  return formatMoneyFromCents(BigInt(value));
}

function largestAllocationDeviation(context: AssistantContext) {
  return Object.entries(context.portfolio.allocation)
    .map(([label, actual]) => ({
      label,
      actual,
      target: context.profile.targetAllocation[label] ?? 0,
      difference: actual - (context.profile.targetAllocation[label] ?? 0),
    }))
    .sort((left, right) => Math.abs(right.difference) - Math.abs(left.difference))[0];
}

export function deriveAssistantInsights(context: AssistantContext): AssistantInsight[] {
  const insights: AssistantInsight[] = [];
  const deviation = largestAllocationDeviation(context);

  if (deviation && Math.abs(deviation.difference) >= 5) {
    const direction = deviation.difference > 0 ? "acima" : "abaixo";
    insights.push({
      kind: "allocation",
      eyebrow: "Distribuição da carteira",
      title: `${deviation.label} está ${percentage(Math.abs(deviation.difference))} ${direction} do alvo.`,
      body: `Sua carteira registrada tem ${percentage(deviation.actual)} nessa classe; o perfil ${context.profile.label} usa ${percentage(deviation.target)} como referência educacional.`,
      href: "/carteira",
      action: "Revisar carteira →",
      color: "var(--cr)",
    });
  }

  if (context.goal && BigInt(context.goal.plannedGapCents) > 0n) {
    insights.push({
      kind: "goal",
      eyebrow: "Ritmo da meta",
      title: `O plano mensal está ${money(context.goal.plannedGapCents)} abaixo do ritmo matemático.`,
      body: `Faltam ${money(context.goal.remainingCents)}. Essa conta divide o valor restante pelo prazo e não supõe rentabilidade.`,
      href: "/metas",
      action: "Ver meta →",
      color: "var(--cx)",
    });
  }

  const selic = context.market.find((indicator) => indicator.code === "selic_target");
  if (selic) {
    insights.push({
      kind: "market",
      eyebrow: selic.stale ? "Dado de mercado desatualizado" : "Panorama oficial",
      title: `${selic.label}: ${selic.value}${selic.unit === "percent_year" ? "% ao ano" : ""}.`,
      body: `Observado em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${selic.observedOn}T12:00:00Z`))}. Fonte: ${selic.source}.`,
      href: "/mercado",
      action: "Abrir mercado →",
      color: "var(--fu)",
    });
  }

  if (insights.length === 0) {
    insights.push({
      kind: "start",
      eyebrow: "Primeiro passo",
      title: "O North precisa de dados cadastrados para observar algo útil.",
      body: "Adicione sua carteira ou uma meta. Sem isso, a gente não inventa saldo, preço ou oportunidade.",
      href: "/carteira",
      action: "Começar pela carteira →",
      color: "var(--intl)",
    });
  }

  return insights.slice(0, 3);
}

export function deterministicAssistantReply(
  question: string,
  context: AssistantContext,
): AssistantReplyCore {
  const normalized = question.toLocaleLowerCase("pt-BR");
  const insights = deriveAssistantInsights(context);
  const deviation = largestAllocationDeviation(context);

  if (/carteira|aloca|rebalance|distribui/.test(normalized)) {
    if (!deviation || BigInt(context.portfolio.totalCents) === 0n) {
      return {
        eyebrow: "Carteira",
        title: "Ainda não há posição suficiente para comparar.",
        paragraphs: [
          "Cadastre seus ativos e movimentações. Depois disso, o North compara a distribuição registrada com o alvo educacional do seu perfil.",
        ],
        facts: [{ label: "Perfil atual", value: context.profile.label }],
        actions: [{ label: "Cadastrar carteira", href: "/carteira" }],
      };
    }
    return {
      eyebrow: "Distribuição registrada",
      title: `${deviation.label} é hoje o maior desvio em relação ao perfil.`,
      paragraphs: [
        `A classe representa ${percentage(deviation.actual)} da carteira cadastrada, enquanto o alvo do perfil ${context.profile.label} é ${percentage(deviation.target)}.`,
        "Isso é um sinal para revisar a distribuição, não uma ordem para comprar ou vender.",
      ],
      facts: [
        { label: "Diferença", value: percentage(deviation.difference) },
        { label: "Patrimônio considerado", value: money(context.portfolio.totalCents) },
      ],
      actions: [
        { label: "Ver carteira", href: "/carteira" },
        { label: "Simular distribuição", href: "/investir" },
      ],
    };
  }

  if (/meta|objetivo|aposent|viagem|prazo/.test(normalized)) {
    if (!context.goal) {
      return {
        eyebrow: "Metas",
        title: "Você ainda não cadastrou uma meta ativa.",
        paragraphs: [
          "Uma meta transforma valor e prazo em um ritmo mensal simples, sem depender de promessa de rentabilidade.",
        ],
        facts: [],
        actions: [{ label: "Criar uma meta", href: "/metas" }],
      };
    }
    return {
      eyebrow: "Ritmo da meta",
      title: BigInt(context.goal.plannedGapCents) > 0n
        ? `Seu plano está ${money(context.goal.plannedGapCents)} abaixo do ritmo mensal.`
        : "Seu plano mensal alcança o ritmo matemático atual.",
      paragraphs: [
        `Faltam ${money(context.goal.remainingCents)}. O ritmo necessário hoje é ${money(context.goal.requiredMonthlyCents)} por mês.`,
        "A conta é uma divisão do valor restante pelo prazo; não inclui retorno, inflação ou impostos.",
      ],
      facts: [
        { label: "Plano atual", value: money(context.goal.plannedMonthlyCents) },
        { label: "Ritmo calculado", value: money(context.goal.requiredMonthlyCents) },
      ],
      actions: [
        { label: "Abrir metas", href: "/metas" },
        { label: "Simular aporte", href: "/investir" },
      ],
    };
  }

  if (/selic|ipca|mercado|juro|infla/.test(normalized)) {
    if (context.market.length === 0) {
      return {
        eyebrow: "Mercado",
        title: "Os indicadores oficiais ainda não estão disponíveis.",
        paragraphs: [
          "Quando a coleta validada chegar, o North mostrará valor, data observada e fonte. A gente não preenche dado ausente com estimativa.",
        ],
        facts: [],
        actions: [{ label: "Ver mercado", href: "/mercado" }],
      };
    }
    return {
      eyebrow: "Indicadores oficiais",
      title: "Este é o panorama que o North conhece agora.",
      paragraphs: [
        "Taxas e inflação ajudam a comparar cenários, mas não determinam sozinhas qual investimento é adequado.",
        context.market.some((item) => item.stale)
          ? "Há dado marcado como desatualizado; confira a data antes de usar a informação."
          : "Os valores abaixo incluem a data observada e vêm das fontes registradas no app.",
      ],
      facts: context.market.slice(0, 3).map((item) => ({
        label: `${item.label} · ${item.observedOn}`,
        value: `${item.value}${item.unit === "percent_year" ? "% a.a." : ""}`,
      })),
      actions: [{ label: "Abrir mercado", href: "/mercado" }],
    };
  }

  if (/cdb|tesouro|renda fixa|cdi/.test(normalized)) {
    return {
      eyebrow: "Renda fixa",
      title: "CDB e Tesouro são emissores, riscos e liquidez diferentes.",
      paragraphs: [
        "No CDB, você empresta ao banco; no Tesouro, ao governo federal. Pra comparar, observe vencimento, liquidez, tributação, risco do emissor e indexador.",
        "O North não conhece uma oferta específica nem confirma rentabilidade de produto sem fonte licenciada e atualizada.",
      ],
      facts: [{ label: "Perfil para contexto", value: context.profile.label }],
      actions: [
        { label: "Ver cenário de mercado", href: "/mercado" },
        { label: "Montar simulação", href: "/investir" },
      ],
    };
  }

  if (/onde inv|o que compro|qual ativo|aporte|sobrando|investir/.test(normalized)) {
    return {
      eyebrow: "Planejamento",
      title: "Posso montar um cenário, mas não escolher um ativo por você.",
      paragraphs: [
        `A distribuição-base do perfil ${context.profile.label} é uma referência educacional e pode ser editada no simulador.`,
        "O simulador salva um plano; não transfere dinheiro e não executa ordens.",
      ],
      facts: Object.entries(context.profile.targetAllocation).map(([label, value]) => ({
        label,
        value: percentage(value),
      })),
      actions: [{ label: "Abrir no Investir", href: "/investir" }],
    };
  }

  return {
    eyebrow: "O que o North conhece",
    title: insights[0]!.title,
    paragraphs: [
      insights[0]!.body,
      "Você pode perguntar sobre distribuição da carteira, ritmo de uma meta, Selic, inflação, CDB, Tesouro ou simulações.",
    ],
    facts: [{ label: "Perfil atual", value: context.profile.label }],
    actions: [{ label: insights[0]!.action.replace(" →", ""), href: insights[0]!.href }],
  };
}
