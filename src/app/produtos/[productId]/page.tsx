import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonPrompt,
  isProductReviewOverdue,
  productClassLabels,
  productInstitution,
  type CatalogProduct,
} from "@/features/institutions/products";
import { formatMoneyFromCents } from "@/features/portfolio/ledger";
import { todayInSaoPaulo } from "@/features/portfolio/submission";
import type { InvestorProfile } from "@/features/suitability/score";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();

  const supabase = await createClient();
  const [{ data: productData }, { data: links }, { data: profileRow }] = await Promise.all([
    supabase
      .from("investment_products")
      .select(`
        id, slug, name, asset_class, summary, return_description, liquidity,
        maturity, minimum_amount, protection, educational_comparison,
        source_url, source_label, jurisdiction, verified_at, review_due_at,
        institutions(id, name, initial, color_token)
      `)
      .eq("id", productId)
      .maybeSingle(),
    supabase.from("user_institutions").select("institution_id"),
    supabase.from("profiles").select("current_assessment_id").maybeSingle(),
  ]);
  if (!productData) notFound();
  const product = productData as unknown as CatalogProduct;
  const institution = productInstitution(product);
  if (!institution || !(links ?? []).some((link) => link.institution_id === institution.id)) {
    notFound();
  }

  const assessmentId = profileRow?.current_assessment_id as string | null | undefined;
  const { data: assessment } = assessmentId
    ? await supabase
      .from("suitability_assessments")
      .select("profile")
      .eq("id", assessmentId)
      .maybeSingle()
    : { data: null };
  const profile = (
    assessment?.profile === "moderado" || assessment?.profile === "arrojado"
  ) ? assessment.profile : "conservador";
  const overdue = isProductReviewOverdue(product.review_due_at, todayInSaoPaulo());
  const [minimumWhole = "0", minimumFraction = ""] = String(
    product.minimum_amount ?? "0",
  ).split(".");
  const minimum = product.minimum_amount == null
    ? "Não informado"
    : formatMoneyFromCents(
      (BigInt(minimumWhole) * 100n)
      + BigInt(minimumFraction.padEnd(2, "0").slice(0, 2)),
    );

  return <main className="product-detail-shell">
    <header className="detail-header">
      <Link href="/produtos" aria-label="Voltar para produtos">←</Link>
      <strong>{institution.name}</strong>
      <span />
    </header>
    <section
      className="product-hero"
      style={{ background: `var(--${institution.color_token})` }}
    >
      <p>{productClassLabels[product.asset_class]} · {institution.name}</p>
      <h1>{product.name}</h1>
      <strong>{overdue ? "Condições aguardando nova revisão" : product.return_description}</strong>
    </section>

    {overdue ? <p className="product-stale" role="status">
      A revisão venceu em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${product.review_due_at}T12:00:00Z`))}.
      Use a fonte oficial para conferir as condições atuais.
    </p> : null}

    <dl className="product-facts">
      <div><dt>Liquidez</dt><dd>{product.liquidity}</dd></div>
      <div><dt>Vencimento</dt><dd>{product.maturity}</dd></div>
      <div><dt>Mínimo</dt><dd>{minimum}</dd></div>
      <div><dt>Proteção</dt><dd>{product.protection}</dd></div>
    </dl>

    <section className="product-worth">
      <p className="eyebrow">Vale a pena?</p>
      <h2>Depende do objetivo e das condições atuais.</h2>
      <p>{product.educational_comparison}</p>
      <p>{comparisonPrompt(profile as InvestorProfile, product.liquidity)}</p>
      <small>Conteúdo educacional. Não é recomendação de investimento.</small>
    </section>

    <section className="product-source">
      <div>
        <span>Fonte oficial</span>
        <strong>{product.source_label}</strong>
      </div>
      <div>
        <span>Verificado em</span>
        <strong>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${product.verified_at}T12:00:00Z`))}</strong>
      </div>
      <div>
        <span>Jurisdição</span>
        <strong>{product.jurisdiction}</strong>
      </div>
      <a href={product.source_url} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>
    </section>
    <Link className="button product-simulate" href="/investir">Simular no Investir</Link>
  </main>;
}
