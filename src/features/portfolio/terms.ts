import { z } from "zod";

export const productTypes = [
  "rdb", "cdb", "lci", "lca", "lc", "conta_remunerada", "poupanca",
  "tesouro_selic", "tesouro_pre", "tesouro_pre_js", "tesouro_ipca", "tesouro_ipca_js",
  "tesouro_renda", "tesouro_educa", "tesouro",
  "fundo", "previdencia", "debenture", "cri", "cra", "outro",
] as const;
export const indexers = ["cdi_pct", "selic_pct", "ipca_mais", "pre", "poupanca", "nenhum"] as const;
export const liquidities = ["diaria", "no_vencimento", "d_mais_n"] as const;
export const fgcOptions = ["sim", "nao", "nao_se_aplica"] as const;
export const taxRegimes = [
  "regressivo", "isento", "previdencia_regressiva", "previdencia_progressiva", "nao_sei",
] as const;

export const productTypeLabels: Record<typeof productTypes[number], string> = {
  rdb: "RDB",
  cdb: "CDB",
  lci: "LCI",
  lca: "LCA",
  lc: "Letra de câmbio (LC)",
  conta_remunerada: "Conta remunerada ou caixinha",
  poupanca: "Poupança",
  tesouro_selic: "Tesouro Selic",
  tesouro_pre: "Tesouro Prefixado",
  tesouro_pre_js: "Tesouro Prefixado com juros semestrais",
  tesouro_ipca: "Tesouro IPCA+",
  tesouro_ipca_js: "Tesouro IPCA+ com juros semestrais",
  tesouro_renda: "Tesouro Renda+",
  tesouro_educa: "Tesouro Educa+",
  tesouro: "Tesouro Direto (outro título)",
  fundo: "Fundo de investimento",
  previdencia: "Previdência",
  debenture: "Debênture",
  cri: "CRI",
  cra: "CRA",
  outro: "Outro",
};

export const indexerLabels: Record<typeof indexers[number], string> = {
  cdi_pct: "% do CDI",
  selic_pct: "% da Selic",
  ipca_mais: "IPCA + taxa",
  pre: "Prefixado",
  poupanca: "Regra da poupança",
  nenhum: "Sem indexador",
};

export const liquidityLabels: Record<typeof liquidities[number], string> = {
  diaria: "Diária (resgate quando quiser)",
  no_vencimento: "Só no vencimento",
  d_mais_n: "Em alguns dias (D+N)",
};

export const fgcLabels: Record<typeof fgcOptions[number], string> = {
  sim: "Sim",
  nao: "Não",
  nao_se_aplica: "Não se aplica",
};

export const taxLabels: Record<typeof taxRegimes[number], string> = {
  regressivo: "IR regressivo (e IOF no início)",
  isento: "Isento de IR para pessoa física",
  previdencia_regressiva: "Previdência, tabela regressiva",
  previdencia_progressiva: "Previdência, tabela progressiva",
  nao_sei: "Não sei",
};

/** Produtos em que o que importa é o saldo (e não a quantidade de cotas). */
export const balanceProducts = new Set<string>([
  "rdb", "cdb", "lc", "lci", "lca", "conta_remunerada", "poupanca",
]);

export type InstrumentTerms = {
  product_type: typeof productTypes[number] | null;
  issuer: string | null;
  indexer: typeof indexers[number] | null;
  rate: string | number | null;
  start_date: string | null;
  maturity_date: string | null;
  liquidity: typeof liquidities[number] | null;
  liquidity_days: number | null;
  fgc: typeof fgcOptions[number] | null;
  tax_regime: typeof taxRegimes[number] | null;
};

const dateText = z.iso.date();
const rateNumber = z.union([z.number(), z.string()])
  .transform((value) => Number(String(value).replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0 && value <= 1000);

/** Entrada da ficha (formulário ou assistente). Campo ausente = não mexe; null = limpa. */
export const instrumentTermsInputSchema = z.object({
  product_type: z.enum(productTypes).nullable().optional(),
  issuer: z.string().trim().min(2).max(80).nullable().optional(),
  indexer: z.enum(indexers).nullable().optional(),
  rate: rateNumber.nullable().optional(),
  start_date: dateText.nullable().optional(),
  maturity_date: dateText.nullable().optional(),
  liquidity: z.enum(liquidities).nullable().optional(),
  liquidity_days: z.number().int().min(0).max(365).nullable().optional(),
  fgc: z.enum(fgcOptions).nullable().optional(),
  tax_regime: z.enum(taxRegimes).nullable().optional(),
}).strict().refine(
  (terms) => !terms.start_date || !terms.maturity_date || terms.maturity_date >= terms.start_date,
  { message: "O vencimento não pode ser antes do início." },
).transform((terms) => {
  // Dias de liquidez só fazem sentido em "D+N"; o modelo às vezes manda 0 junto com "diária".
  if (terms.liquidity !== undefined && terms.liquidity !== "d_mais_n" && "liquidity_days" in terms) {
    const { liquidity_days: _ignored, ...rest } = terms;
    void _ignored;
    return rest;
  }
  return terms;
});

export type InstrumentTermsInput = z.output<typeof instrumentTermsInputSchema>;

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatRate(rate: number) {
  return rate.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function rateLabel(indexer: InstrumentTerms["indexer"], rate: string | number | null) {
  if (rate === null || rate === undefined || rate === "") return null;
  const value = formatRate(Number(rate));
  if (indexer === "cdi_pct") return `${value}% do CDI`;
  if (indexer === "selic_pct") return `${value}% da Selic`;
  if (indexer === "ipca_mais") return `IPCA + ${value}% ao ano`;
  if (indexer === "pre") return `${value}% ao ano`;
  return `${value}%`;
}

/** Linhas legíveis da ficha (só o que foi preenchido). */
export function describeTerms(terms: InstrumentTerms | null) {
  if (!terms) return [] as Array<{ label: string; value: string }>;
  const rows: Array<{ label: string; value: string }> = [];
  if (terms.product_type) rows.push({ label: "Tipo", value: productTypeLabels[terms.product_type] });
  if (terms.issuer) rows.push({ label: "Emissor", value: terms.issuer });
  const rate = rateLabel(terms.indexer, terms.rate);
  if (rate) rows.push({ label: "Rendimento", value: rate });
  else if (terms.indexer) rows.push({ label: "Rendimento", value: indexerLabels[terms.indexer] });
  if (terms.start_date) rows.push({ label: "Início", value: formatDate(terms.start_date) });
  if (terms.maturity_date) rows.push({ label: "Vencimento", value: formatDate(terms.maturity_date) });
  if (terms.liquidity) {
    rows.push({
      label: "Liquidez",
      value: terms.liquidity === "d_mais_n" && terms.liquidity_days !== null
        ? `D+${terms.liquidity_days}`
        : liquidityLabels[terms.liquidity].split(" (")[0] ?? liquidityLabels[terms.liquidity],
    });
  }
  if (terms.fgc) rows.push({ label: "FGC", value: fgcLabels[terms.fgc] });
  if (terms.tax_regime) rows.push({ label: "Tributação", value: taxLabels[terms.tax_regime] });
  return rows;
}

/** Mostra só o saldo (sem quantidade de cotas) quando o produto é de saldo. */
export function isBalanceProduct(productType: string | null | undefined) {
  return productType ? balanceProducts.has(productType) : false;
}
