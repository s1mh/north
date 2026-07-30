import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  isProductReviewOverdue,
  productClassLabels,
  productInstitution,
  type CatalogProduct,
} from "@/features/institutions/products";
import { todayInSaoPaulo } from "@/features/portfolio/submission";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("user_institutions")
    .select("institution_id");
  const institutionIds = (links ?? []).map((link) => link.institution_id as string);
  const { data } = institutionIds.length > 0
    ? await supabase
      .from("investment_products")
      .select(`
        id, slug, name, asset_class, summary, return_description, liquidity,
        maturity, minimum_amount, protection, educational_comparison,
        source_url, source_label, jurisdiction, verified_at, review_due_at,
        institutions(id, name, initial, color_token)
      `)
      .in("institution_id", institutionIds)
      .order("name")
    : { data: [] };
  const products = (data ?? []) as unknown as CatalogProduct[];
  const groups = products.reduce<Map<string, {
    institution: ReturnType<typeof productInstitution>;
    products: CatalogProduct[];
  }>>((map, product) => {
    const institution = productInstitution(product);
    if (!institution) return map;
    const current = map.get(institution.id);
    if (current) current.products.push(product);
    else map.set(institution.id, { institution, products: [product] });
    return map;
  }, new Map());
  const today = todayInSaoPaulo();

  return <AppShell active="">
    <div className="products-heading">
      <div>
        <p className="eyebrow">Informação com procedência</p>
        <h1>Produtos</h1>
        <p>O que seus bancos oferecem, com fonte e data de revisão.</p>
      </div>
      <Link href="/onboarding/bancos?next=/produtos">Meus bancos</Link>
    </div>

    {institutionIds.length === 0 ? <section className="empty-card products-empty">
      <h2>Escolha seus bancos primeiro.</h2>
      <p>O catálogo mostra somente instituições vinculadas por você.</p>
      <Link className="button" href="/onboarding/bancos?next=/produtos">Escolher bancos</Link>
    </section> : products.length === 0 ? <section className="empty-card products-empty">
      <h2>Ainda não há produto revisado.</h2>
      <p>Instituições sem catálogo permanecem sem condições inventadas.</p>
      <Link className="button" href="/onboarding/bancos?next=/produtos">Revisar bancos</Link>
    </section> : <>
      <section className="product-observe">
        <p className="eyebrow">Para comparar</p>
        <h2>Liquidez, proteção, prazo e taxa precisam ser lidos juntos.</h2>
        <p>Os destaques abaixo não são ranking nem recomendação personalizada.</p>
      </section>
      <div className="product-groups">
        {[...groups.values()].map(({ institution, products: items }) => <section key={institution!.id}>
          <header>
            <span style={{ background: `var(--${institution!.color_token})` }}>{institution!.initial}</span>
            <h2>{institution!.name}</h2>
          </header>
          <div>
            {items.map((product) => {
              const overdue = isProductReviewOverdue(product.review_due_at, today);
              return <Link className="product-row" href={`/produtos/${product.id}`} key={product.id}>
                <span>{productClassLabels[product.asset_class] ?? "Produto"}</span>
                <div>
                  <strong>{product.name}</strong>
                  <small>{overdue ? "Revisão vencida" : `${product.return_description} · ${product.liquidity}`}</small>
                </div>
                <b>›</b>
              </Link>;
            })}
          </div>
        </section>)}
      </div>
      <p className="product-disclaimer">
        Catálogo educacional. Condições podem mudar; confirme sempre na fonte oficial antes de decidir.
      </p>
    </>}
  </AppShell>;
}
