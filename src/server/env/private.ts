import "server-only";
import { z } from "zod";

const optionalSecret = (minimum: number) => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().min(minimum).optional(),
);

const privateEnvSchema = z.object({
  SUPABASE_SECRET_KEY: optionalSecret(20),
  LLM_API_KEY: optionalSecret(20),
  MARKET_DATA_API_KEY: optionalSecret(20),
  CRON_SECRET: optionalSecret(32),
});

export function getPrivateEnv() {
  return parsePrivateEnv({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    LLM_API_KEY: process.env.LLM_API_KEY,
    MARKET_DATA_API_KEY: process.env.MARKET_DATA_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
}

export function parsePrivateEnv(input: unknown) {
  return privateEnvSchema.parse(input);
}
