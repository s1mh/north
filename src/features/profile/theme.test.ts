import { describe, expect, it } from "vitest";
import { themePreferenceSchema } from "@/features/profile/theme";

describe("theme preference", () => {
  it.each(["system", "light", "dark"])("accepts %s", (theme) => {
    expect(themePreferenceSchema.safeParse({ theme }).success).toBe(true);
  });

  it("rejects arbitrary theme values", () => {
    expect(themePreferenceSchema.safeParse({ theme: "contrast<script>" }).success)
      .toBe(false);
  });
});
