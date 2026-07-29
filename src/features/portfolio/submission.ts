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

const positiveDecimal = z.string()
  .trim()
  .regex(/^\d{1,15}([.,]\d{1,8})?$/)
  .transform((value) => value.replace(",", "."))
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
