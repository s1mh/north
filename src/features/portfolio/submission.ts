import { z } from "zod";

export function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export const assetClasses = [
  "renda_fixa",
  "acoes",
  "fundos",
  "fiis",
  "internacional",
  "cripto",
  "outros",
] as const;

export const transactionTypes = [
  "compra",
  "venda",
  "aporte",
  "resgate",
  "rendimento",
  "taxa",
] as const;

const decimal = z.string()
  .trim()
  .regex(/^\d{1,15}([.,]\d{1,8})?$/)
  .transform((value) => value.replace(",", "."));

const positiveDecimal = decimal
  .refine((value) => BigInt(value.replace(".", "")) > 0n);

const nonNegativeMoney = z.string()
  .trim()
  .regex(/^\d{1,15}([.,]\d{1,2})?$/)
  .transform((value) => value.replace(",", "."));

export const portfolioAssetSchema = z.object({
  institutionName: z.string().trim().min(2).max(80),
  symbol: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  assetClass: z.enum(assetClasses),
  quantity: positiveDecimal,
  unitPrice: positiveDecimal,
  fees: nonNegativeMoney,
  tradeDate: z.iso.date().refine((value) => value <= todayInSaoPaulo()),
}).strict();

const transactionFields = {
  transactionType: z.enum(transactionTypes),
  quantity: decimal,
  unitPrice: decimal,
  fees: nonNegativeMoney,
  cashAmount: nonNegativeMoney,
  tradeDate: z.iso.date().refine((value) => value <= todayInSaoPaulo()),
};

function validateTransactionShape(
  value: {
    transactionType: typeof transactionTypes[number];
    quantity: string;
    unitPrice: string;
    cashAmount: string;
  },
  context: z.RefinementCtx,
) {
  const changesPosition = ["compra", "venda", "aporte", "resgate"].includes(value.transactionType);
  const quantityIsPositive = BigInt(value.quantity.replace(".", "")) > 0n;
  const unitPriceIsPositive = BigInt(value.unitPrice.replace(".", "")) > 0n;
  const cashAmountIsPositive = BigInt(value.cashAmount.replace(".", "")) > 0n;

  if (changesPosition && (!quantityIsPositive || !unitPriceIsPositive || cashAmountIsPositive)) {
    context.addIssue({ code: "custom", message: "Movimentação de posição inválida." });
  }

  if (!changesPosition && (quantityIsPositive || unitPriceIsPositive || !cashAmountIsPositive)) {
    context.addIssue({ code: "custom", message: "Movimentação financeira inválida." });
  }
}

export const portfolioTransactionSchema = z.object({
  instrumentId: z.uuid(),
  ...transactionFields,
}).strict().superRefine(validateTransactionShape);

export const portfolioCorrectionSchema = z.object({
  transactionId: z.uuid(),
  reason: z.string().trim().min(3).max(200),
  ...transactionFields,
}).strict().superRefine(validateTransactionShape);

export const portfolioReversalSchema = z.object({
  transactionId: z.uuid(),
  reason: z.string().trim().min(3).max(200),
}).strict();
