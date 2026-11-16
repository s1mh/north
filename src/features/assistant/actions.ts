import { z } from "zod";
import { goalContributionSchema, goalSchema } from "@/features/goals/submission";
import { portfolioAssetSchema, portfolioReversalSchema, portfolioTransactionSchema } from "@/features/portfolio/submission";

export const actionKinds = [
  "record_transaction", "create_asset", "goal_contribution", "reverse_transaction", "create_goal",
] as const;
export type ActionKind = typeof actionKinds[number];

export const actionStatuses = [
  "proposed", "confirming", "confirmed", "cancelled", "failed", "undoing", "undone",
] as const;
export type ActionStatus = typeof actionStatuses[number];

/** O que fica guardado: os dados validados + um rótulo legível (o rótulo é só para exibir). */
export const recordTransactionPayloadSchema = z.object({
  data: portfolioTransactionSchema,
  instrumentLabel: z.string().trim().min(1).max(120),
}).strict();

export const createAssetPayloadSchema = z.object({
  data: portfolioAssetSchema,
}).strict();

export const goalContributionPayloadSchema = z.object({
  data: goalContributionSchema,
  goalName: z.string().trim().min(1).max(120),
}).strict();

export const reverseTransactionPayloadSchema = z.object({
  data: portfolioReversalSchema,
  label: z.string().trim().min(1).max(160),
}).strict();

export const createGoalPayloadSchema = z.object({
  data: goalSchema,
}).strict();

/** Só o que cria um registro simples tem "Desfazer"; estorno e meta ficam auditados e se tratam nas telas. */
export function canUndo(kind: ActionKind) {
  return kind === "record_transaction" || kind === "create_asset" || kind === "goal_contribution";
}

export const payloadSchemas = {
  reverse_transaction: reverseTransactionPayloadSchema,
  create_goal: createGoalPayloadSchema,
  record_transaction: recordTransactionPayloadSchema,
  create_asset: createAssetPayloadSchema,
  goal_contribution: goalContributionPayloadSchema,
} as const;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function money(value: number) {
  return brl.format(Number.isFinite(value) ? value : 0);
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const transactionLabels: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  aporte: "Aporte",
  resgate: "Resgate",
  rendimento: "Rendimento",
  taxa: "Taxa",
};

const classLabels: Record<string, string> = {
  renda_fixa: "Renda fixa",
  acoes: "Ações B3",
  fundos: "Fundos",
  fiis: "FIIs",
  internacional: "Internacional",
  cripto: "Cripto",
  outros: "Outros",
};

export type ActionView = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

/** Texto do cartão de confirmação. Os números vêm dos dados validados, nunca do texto da IA. */
export function describeAction(kind: ActionKind, payload: unknown): ActionView | null {
  if (kind === "record_transaction") {
    const parsed = recordTransactionPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    const { data, instrumentLabel } = parsed.data;
    const movesPosition = ["compra", "venda", "aporte", "resgate"].includes(data.transactionType);
    const amount = movesPosition
      ? Number(data.quantity) * Number(data.unitPrice)
      : Number(data.cashAmount);
    const rows = [
      { label: "Ativo", value: instrumentLabel },
      { label: "Valor", value: money(amount) },
    ];
    if (movesPosition && Number(data.fees) > 0) rows.push({ label: "Taxas", value: money(Number(data.fees)) });
    rows.push({ label: "Data", value: formatDate(data.tradeDate) });
    return { title: `Registrar ${transactionLabels[data.transactionType]?.toLowerCase() ?? "movimentação"}`, rows };
  }
  if (kind === "create_asset") {
    const parsed = createAssetPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    const { data } = parsed.data;
    return {
      title: "Criar ativo e registrar a compra",
      rows: [
        { label: "Instituição", value: data.institutionName },
        { label: "Ativo", value: `${data.name} (${data.symbol})` },
        { label: "Classe", value: classLabels[data.assetClass] ?? data.assetClass },
        { label: "Valor", value: money(Number(data.quantity) * Number(data.unitPrice) + Number(data.fees)) },
        { label: "Data", value: formatDate(data.tradeDate) },
      ],
    };
  }
  if (kind === "reverse_transaction") {
    const parsed = reverseTransactionPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    return {
      title: "Estornar lançamento",
      rows: [
        { label: "Lançamento", value: parsed.data.label },
        { label: "Motivo", value: parsed.data.data.reason },
      ],
    };
  }
  if (kind === "create_goal") {
    const parsed = createGoalPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    const { data } = parsed.data;
    const rows = [
      { label: "Meta", value: data.name },
      { label: "Valor alvo", value: money(Number(data.targetAmount)) },
      { label: "Até", value: formatDate(data.targetDate) },
    ];
    if (Number(data.plannedMonthlyAmount) > 0) {
      rows.push({ label: "Aporte mensal", value: money(Number(data.plannedMonthlyAmount)) });
    }
    return { title: "Criar meta", rows };
  }
  const parsed = goalContributionPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { data, goalName } = parsed.data;
  const rows = [
    { label: "Meta", value: goalName },
    { label: "Valor", value: money(Number(data.amount)) },
    { label: "Data", value: formatDate(data.contributedOn) },
  ];
  if (data.note) rows.push({ label: "Observação", value: data.note });
  return { title: "Registrar aporte na meta", rows };
}
