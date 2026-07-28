import type { Metadata } from "next";
import { SignUpForm } from "@/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <main className="auth-shell"><SignUpForm /></main>;
}
