import "server-only";
import { z } from "zod";

const privateEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  LLM_API_KEY: z.string().min(20).optional(),
  MARKET_DATA_API_KEY: z.string().min(20).optional(),
  CRON_SECRET: z.string().min(32).optional(),
});

export function getPrivateEnv() {
  return privateEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    LLM_API_KEY: process.env.LLM_API_KEY,
    MARKET_DATA_API_KEY: process.env.MARKET_DATA_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
}
