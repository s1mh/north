import { describe, expect, it } from "vitest";
import { verifyCronAuthorization } from "@/features/market/cron-auth";

describe("cron authorization", () => {
  const secret = "a".repeat(32);

  it("accepts only the exact bearer secret", () => {
    expect(verifyCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyCronAuthorization(`Bearer ${secret}x`, secret)).toBe(false);
    expect(verifyCronAuthorization(secret, secret)).toBe(false);
  });

  it("fails closed when configuration is absent or weak", () => {
    expect(verifyCronAuthorization(null, secret)).toBe(false);
    expect(verifyCronAuthorization("Bearer undefined", undefined)).toBe(false);
    expect(verifyCronAuthorization("Bearer short", "short")).toBe(false);
  });
});
