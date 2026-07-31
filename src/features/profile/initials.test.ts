import { describe, expect, it } from "vitest";
import { profileInitials } from "@/features/profile/initials";

describe("profile initials", () => {
  it.each([
    ["North Stress Teste", "NT"],
    ["Samuel Rocha", "SR"],
    ["Érica", "ÉR"],
    ["  Ana   Maria  ", "AM"],
    [null, "N"],
  ])("derives %s as %s", (name, expected) => {
    expect(profileInitials(name)).toBe(expected);
  });
});
