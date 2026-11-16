/** Títulos do Tesouro Direto: nome no arquivo oficial, apelido curto e tipo na ficha do ativo. */
export const TREASURY_TITLES = [
  { type: "Tesouro Selic", slug: "SELIC", productType: "tesouro_selic", label: "Tesouro Selic" },
  { type: "Tesouro Prefixado", slug: "PRE", productType: "tesouro_pre", label: "Tesouro Prefixado" },
  { type: "Tesouro Prefixado com Juros Semestrais", slug: "PREJS", productType: "tesouro_pre_js", label: "Tesouro Prefixado com juros semestrais" },
  { type: "Tesouro IPCA+", slug: "IPCA", productType: "tesouro_ipca", label: "Tesouro IPCA+" },
  { type: "Tesouro IPCA+ com Juros Semestrais", slug: "IPCAJS", productType: "tesouro_ipca_js", label: "Tesouro IPCA+ com juros semestrais" },
  { type: "Tesouro Renda+ Aposentadoria Extra", slug: "RENDA", productType: "tesouro_renda", label: "Tesouro Renda+" },
  { type: "Tesouro Educa+", slug: "EDUCA", productType: "tesouro_educa", label: "Tesouro Educa+" },
] as const;

export type TreasuryProductType = typeof TREASURY_TITLES[number]["productType"];

export const treasuryProductTypes = TREASURY_TITLES.map((title) => title.productType);

export function treasurySlug(type: string) {
  const known = TREASURY_TITLES.find((title) => title.type === type);
  if (known) return known.slug;
  return type.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || "TD";
}

/** Identificador estável do título no arquivo oficial (tipo + vencimento). */
export function treasurySourceId(type: string, maturity: string) {
  return `${type}|${maturity}`;
}

/** Ficha do ativo -> identificador do título (null se faltar tipo ou vencimento). */
export function treasurySourceIdFromTerms(productType: string | null | undefined, maturity: string | null | undefined) {
  const title = TREASURY_TITLES.find((item) => item.productType === productType);
  if (!title || !maturity) return null;
  return treasurySourceId(title.type, maturity);
}
