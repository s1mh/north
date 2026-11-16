import type { Metadata } from "next";
import { MfaChallengeForm } from "@/features/auth/mfa-challenge-form";

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default function VerifyPage() {
  return <main className="auth-shell"><MfaChallengeForm /></main>;
}
