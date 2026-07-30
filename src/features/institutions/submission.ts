import { z } from "zod";

const uuidSchema = z.string().uuid();

export const institutionSelectionSchema = z.object({
  institutionIds: z.array(uuidSchema).min(1).max(10),
}).superRefine(({ institutionIds }, context) => {
  if (new Set(institutionIds).size !== institutionIds.length) {
    context.addIssue({
      code: "custom",
      message: "Instituições repetidas.",
      path: ["institutionIds"],
    });
  }
});
export const institutionResearchSchema = z.object({
  name: z.string()
    .trim()
    .min(2)
    .max(80)
    .refine((value) => !/(https?:\/\/|www\.|@|[<>{}])/i.test(value)),
});
