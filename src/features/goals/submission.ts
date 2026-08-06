import { z } from "zod";
import { todayInSaoPaulo } from "@/features/portfolio/submission";

export const goalKinds = [
  "aposentadoria",
  "viagem",
  "imovel",
  "carro",
  "reserva",
  "personalizada",
] as const;

const money = z.string()
  .trim()
  .refine((value) => (
    /^\d{1,15}(?:\.\d{1,2})?$/.test(value)
    || /^\d{1,15}(?:,\d{1,2})?$/.test(value)
    || /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(value)
  ))
  .transform((value) => {
    if (value.includes(",")) return value.replaceAll(".", "").replace(",", ".");
    if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) return value.replaceAll(".", "");
    return value;
  });

const positiveMoney = money.refine((value) => BigInt(value.replace(".", "")) > 0n);

export const goalSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(goalKinds),
  targetAmount: positiveMoney,
  targetDate: z.iso.date().refine((value) => value > todayInSaoPaulo()),
  plannedMonthlyAmount: money,
}).strict();

export const goalContributionSchema = z.object({
  goalId: z.uuid(),
  amount: positiveMoney,
  contributedOn: z.iso.date().refine((value) => value <= todayInSaoPaulo()),
  note: z.string().trim().max(120).transform((value) => value || null),
}).strict();

export const goalContributionReversalSchema = z.object({
  contributionId: z.uuid(),
  reason: z.string().trim().min(3).max(160),
}).strict();
