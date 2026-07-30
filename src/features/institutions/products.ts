import type { InvestorProfile } from "@/features/suitability/score";

export const productClassLabels: Record<string, string> = {
  renda_fixa: "Renda Fixa",
  acoes: "Ações",
  fundos: "Fundos",
  fiis: "FIIs",
  internacional: "Internacional",
  cripto: "Cripto",
  outros: "Outros",
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  asset_class: string;
  summary: string;
  return_description: string;
  liquidity: string;
  maturity: string;
  minimum_amount: string | number | null;
  protection: string;
  educational_comparison: string;
  source_url: string;
  source_label: string;
  jurisdiction: string;
  verified_at: string;
  review_due_at: string;
  institutions: {
    id: string;
    name: string;
    initial: string;
    color_token: string;
  } | Array<{
    id: string;
    name: string;
    initial: string;
    color_token: string;
  }>;
};

export function productInstitution(product: CatalogProduct) {
  return Array.isArray(product.institutions)
    ? product.institutions[0]
    : product.institutions;
}
export function isProductReviewOverdue(reviewDueAt: string, today: string) {
  return reviewDueAt < today;
}

export function comparisonPrompt(profile: InvestorProfile, liquidity: string) {
  const profileCopy = {
    conservador: "No perfil Conservador, dê peso especial a liquidez, proteção e risco de crédito.",
    moderado: "No perfil Moderado, compare o papel do produto com prazo, liquidez e diversificação.",
    arrojado: "Mesmo no perfil Arrojado, liquidez, risco de crédito e concentração continuam relevantes.",
  }[profile];
  return `${profileCopy} Liquidez informada: ${liquidity}.`;
}
