import { z } from "zod";
import { passwordSchema } from "@/features/auth/auth-schema";

const currentPassword = z.string().min(1).max(128);

export const passwordChangeSchema = z.object({
  currentPassword,
  password: passwordSchema,
  confirmation: z.string(),
}).strict()
  .refine(
    ({ password, confirmation }) => password === confirmation,
    { path: ["confirmation"], message: "As senhas precisam ser iguais." },
  )
  .refine(
    ({ password, currentPassword: current }) => password !== current,
    { path: ["password"], message: "Escolha uma senha diferente da atual." },
  );

export const emailChangeSchema = z.object({
  currentPassword,
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
}).strict();

export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;
export type EmailChangeInput = z.input<typeof emailChangeSchema>;
