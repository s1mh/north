import { z } from "zod";

export const ACCOUNT_DELETION_PHRASE = "EXCLUIR MINHA CONTA";

export const accountDeletionSchema = z.object({
  confirmation: z.literal(ACCOUNT_DELETION_PHRASE),
  password: z.string().min(10).max(128),
}).strict();
