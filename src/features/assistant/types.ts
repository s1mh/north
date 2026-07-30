export type AssistantContext = {
  profile: {
    label: "Conservador" | "Moderado" | "Arrojado";
    targetAllocation: Record<string, number>;
  };
  portfolio: {
    totalCents: string;
    allocation: Record<string, number>;
  };
  goal: null | {
    remainingCents: string;
    requiredMonthlyCents: string;
    plannedMonthlyCents: string;
    plannedGapCents: string;
  };
  market: Array<{
    code: string;
    label: string;
    value: string;
    unit: string;
    observedOn: string;
    stale: boolean;
    source: string;
  }>;
};

export type AssistantAction = {
  label: string;
  href: "/carteira" | "/investir" | "/mercado" | "/metas";
};

export type AssistantReplyCore = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  facts: Array<{ label: string; value: string }>;
  actions: AssistantAction[];
};

export type AssistantReply = AssistantReplyCore & {
  disclaimer: string;
};

export type AssistantInsight = {
  kind: "allocation" | "goal" | "market" | "start";
  eyebrow: string;
  title: string;
  body: string;
  href: "/carteira" | "/mercado" | "/metas";
  action: string;
  color: string;
};
