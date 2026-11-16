import { describe, expect, it } from "vitest";
import { emailChangeSchema, passwordChangeSchema } from "./credentials";

const base = {
  currentPassword: "North!Teste2026",
  password: "Outra!Senha2027",
  confirmation: "Outra!Senha2027",
};

describe("passwordChangeSchema", () => {
  it("accepts a strong, different, confirmed password", () => {
    expect(passwordChangeSchema.safeParse(base).success).toBe(true);
  });
  it("rejects mismatched confirmation", () => {
    expect(passwordChangeSchema.safeParse({ ...base, confirmation: "x" }).success).toBe(false);
  });
  it("rejects a weak new password", () => {
    expect(passwordChangeSchema.safeParse({ ...base, password: "fraca", confirmation: "fraca" }).success).toBe(false);
  });
  it("rejects reusing the current password", () => {
    expect(passwordChangeSchema.safeParse({
      ...base, password: base.currentPassword, confirmation: base.currentPassword,
    }).success).toBe(false);
  });
  it("rejects unexpected fields", () => {
    expect(passwordChangeSchema.safeParse({ ...base, userId: "x" }).success).toBe(false);
  });
});

describe("emailChangeSchema", () => {
  it("normalizes the e-mail", () => {
    const parsed = emailChangeSchema.parse({ currentPassword: "abc", email: "  NOVO@Exemplo.com " });
    expect(parsed.email).toBe("novo@exemplo.com");
  });
  it("rejects invalid e-mails and extra fields", () => {
    expect(emailChangeSchema.safeParse({ currentPassword: "abc", email: "nao-e-email" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ currentPassword: "abc", email: "a@b.co", id: "x" }).success).toBe(false);
  });
});
