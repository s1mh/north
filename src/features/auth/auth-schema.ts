import { z } from "zod";

export const TERMS_VERSION = "2026-07-28";
export const PRIVACY_VERSION = "2026-07-28";

const email = z.string().trim().toLowerCase().email("Digite um e-mail válido.");
export const passwordSchema = z.string()
  .min(10, "Use pelo menos 10 caracteres.")
  .regex(/[a-z]/, "Inclua uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
  .regex(/\d/, "Inclua um número.")
  .regex(/[^A-Za-z0-9]/, "Inclua um símbolo.");

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Digite seu nome completo.").max(80, "Use até 80 caracteres."),
  email,
  password: passwordSchema,
  acceptedTerms: z.literal(true, { error: "Aceite os Termos e a Política de Privacidade." }),
}).strict();

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Digite sua senha."),
}).strict();

export const passwordResetRequestSchema = z.object({ email }).strict();
export const passwordUpdateSchema = z.object({
  password: passwordSchema,
  confirmation: z.string(),
}).strict().refine(
  ({ password, confirmation }) => password === confirmation,
  { path: ["confirmation"], message: "As senhas precisam ser iguais." },
);

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
