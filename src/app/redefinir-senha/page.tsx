import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/features/auth/update-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default function UpdatePasswordPage() {
  return <main className="auth-shell"><UpdatePasswordForm /></main>;
}
