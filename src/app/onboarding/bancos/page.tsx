import type { Metadata } from "next";
import { BankSelection } from "@/features/onboarding/bank-selection";

export const metadata: Metadata = { title: "Seus bancos" };

export default function BanksPage() {
  return <BankSelection />;
}
