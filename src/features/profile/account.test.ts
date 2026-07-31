import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_PHRASE,
  accountDeletionSchema,
} from "./account";

describe("accountDeletionSchema", () => {
  it("accepts the exact confirmation phrase and a current password", () => {
    expect(accountDeletionSchema.safeParse({
      confirmation: ACCOUNT_DELETION_PHRASE,
      password: "North!Teste2026",
    }).success).toBe(true);
  });

  it("rejects approximate confirmation phrases", () => {
    expect(accountDeletionSchema.safeParse({
      confirmation: "excluir minha conta",
      password: "North!Teste2026",
    }).success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(accountDeletionSchema.safeParse({
      confirmation: ACCOUNT_DELETION_PHRASE,
      password: "North!Teste2026",
      userId: "another-user",
    }).success).toBe(false);
  });
});
