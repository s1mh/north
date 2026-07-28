import type { Metadata } from "next";
import { SuitabilityFlow } from "@/features/suitability/suitability-flow";

export const metadata: Metadata = {
  title: "Seu perfil",
  description: "Descubra seu perfil de investidor com o questionário do North.",
};

export default function SuitabilityPage() {
  return <SuitabilityFlow />;
}
