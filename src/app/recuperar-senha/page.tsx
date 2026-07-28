import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ResetPasswordPage() {
  return <main className="auth-shell"><ResetPasswordForm /></main>;
}
