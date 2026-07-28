import { z } from "zod";

export const suitabilitySubmissionSchema = z.object({
  answers: z.record(z.string(), z.string()),
}).strict();
