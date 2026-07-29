import { z } from "zod";

export const simulationModes = ["free", "goal"] as const;
export const contributionFrequencies = ["once", "monthly"] as const;
export const allocationLabels = [
  "Renda Fixa",
  "Fundos",
  "Ações · ETF",
  "FIIs",
  "Internacional",
  "Cripto",
] as const;

const money = z.string()
  .trim()
  .refine((value) => (
    /^\d{1,15}(?:\.\d{1,2})?$/.test(value)
    || /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(value)
  ))
  .transform((value) => {
    if (value.includes(",")) return value.replaceAll(".", "").replace(",", ".");
    if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) return value.replaceAll(".", "");
    return value;
  })
  .refine((value) => BigInt(value.replace(".", "")) > 0n);

const percentage = z.number().int().min(0).max(100);

export const investmentSimulationSchema = z.object({
  mode: z.enum(simulationModes),
  goalId: z.uuid().nullable(),
  frequency: z.enum(contributionFrequencies),
  contributionAmount: money,
  horizonMonths: z.number().int().min(1).max(600),
  annualReturnRate: z.number().min(0).max(30),
  annualInflationRate: z.number().min(0).max(20),
  annualFeeRate: z.number().min(0).max(10),
  allocation: z.record(z.string(), percentage),
}).strict().superRefine((value, context) => {
  if ((value.mode === "goal") !== Boolean(value.goalId)) {
    context.addIssue({ code: "custom", message: "Vínculo com meta inválido." });
  }
  if (value.annualFeeRate > value.annualReturnRate) {
    context.addIssue({ code: "custom", message: "Taxa maior que o retorno." });
  }
  const percentages = Object.values(value.allocation);
  if (Object.keys(value.allocation).some((label) => (
    !allocationLabels.includes(label as typeof allocationLabels[number])
  ))) {
    context.addIssue({ code: "custom", message: "Classe de ativo inválida." });
  }
  if (percentages.length === 0 || percentages.reduce((total, item) => total + item, 0) !== 100) {
    context.addIssue({ code: "custom", message: "A distribuição deve somar 100%." });
  }
});
