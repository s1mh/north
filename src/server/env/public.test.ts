import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./public";

const key = "x".repeat(24);

describe("parsePublicEnv", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "https://north.supabase.co",
  ])("aceita a URL permitida %s", (url) => {
    expect(parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    }).NEXT_PUBLIC_SUPABASE_URL).toBe(url);
  });

  it.each([
    "http://north.supabase.co",
    "http://192.168.0.10:54321",
    "ftp://north.example.com",
  ])("rejeita a URL insegura %s", (url) => {
    expect(() => parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    })).toThrow();
  });
});
