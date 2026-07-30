import { z } from "zod";
import { ASSISTANT_DISCLAIMER } from "@/features/assistant/policy";

const actionHref = z.enum(["/carteira", "/investir", "/mercado", "/metas"]);

export const assistantReplyCoreSchema = z.object({
  eyebrow: z.string().trim().min(2).max(50),
  title: z.string().trim().min(2).max(180),
  paragraphs: z.array(z.string().trim().min(2).max(500)).min(1).max(3),
  facts: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(80),
  }).strict()).max(6),
  actions: z.array(z.object({
    label: z.string().trim().min(2).max(60),
    href: actionHref,
  }).strict()).max(2),
}).strict();

export const assistantReplySchema = assistantReplyCoreSchema.extend({
  disclaimer: z.literal(ASSISTANT_DISCLAIMER),
}).strict();

export function attachServerDisclaimer(input: unknown) {
  const core = assistantReplyCoreSchema.parse(input);
  return { ...core, disclaimer: ASSISTANT_DISCLAIMER };
}
