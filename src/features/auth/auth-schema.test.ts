import { describe, expect, it } from "vitest";
import {
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signInSchema,
  signUpSchema,
} from "./auth-schema";

describe("signUpSchema", () => {
  const valid = {
    displayName: "Marina Silva",
    email: "MARINA@EXAMPLE.COM ",
    password: "N0rth!segura",
    acceptedTerms: true as const,
  };

  it("normaliza nome e e-mail válidos", () => {
    expect(signUpSchema.parse(valid)).toEqual({
      ...valid,
      displayName: "Marina Silva",
      email: "marina@example.com",
    });
  });

  it.each([
    ["senha curta", { ...valid, password: "N0rth!" }],
    ["sem símbolo", { ...valid, password: "North123456" }],
    ["sem aceite", { ...valid, acceptedTerms: false }],
    ["campo extra", { ...valid, admin: true }],
  ])("rejeita %s", (_, input) => {
    expect(signUpSchema.safeParse(input).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("não revela regras de cadastro ao validar login", () => {
    expect(signInSchema.safeParse({ email: "marina@example.com", password: "x" }).success).toBe(true);
  });
});

describe("passwordResetRequestSchema", () => {
  it("normaliza o e-mail sem revelar se a conta existe", () => {
    expect(passwordResetRequestSchema.parse({ email: " MARINA@EXAMPLE.COM " }))
      .toEqual({ email: "marina@example.com" });
  });
});

describe("passwordUpdateSchema", () => {
  it("aceita duas senhas fortes e iguais", () => {
    expect(passwordUpdateSchema.safeParse({
      password: "N0rth!segura",
      confirmation: "N0rth!segura",
    }).success).toBe(true);
  });

  it("rejeita confirmações diferentes", () => {
    expect(passwordUpdateSchema.safeParse({
      password: "N0rth!segura",
      confirmation: "Outra!senha1",
    }).success).toBe(false);
  });
});
