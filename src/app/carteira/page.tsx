import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { isBalanceProduct } from "@/features/portfolio/terms";
import {
  formatMoneyFromCents,
  formatQuantity,
} from "@/features/portfolio/ledger";
import { todayInSaoPaulo } from "@/features/portfolio/submission";
import { ESTIMATE_DISCLAIMER, valueSourceLabel } from "@/features/portfolio/value";
import { PORTFOLIO_VALUE_SELECT, valuePortfolio, type ValuableInstrument } from "@/server/portfolio/values";
import { createClient } from "@/server/supabase/client";

const classes: Record<string, { label: string; color: string }> = {
  renda_fixa: { label: "Renda fixa", color: "var(--rf)" },
  acoes: { label: "Ações B3", color: "var(--ac)" },
  fundos: { label: "Fundos", color: "var(--fu)" },
  fiis: { label: "FIIs", color: "var(--fi)" },
  internacional: { label: "Internacional", color: "var(--intl)" },
  cripto: { label: "Cripto", color: "var(--cr)" },
  outros: { label: "Outros", color: "var(--cx)" },
};

export const dynamic = "force-dynamic";

export default async function CarteiraPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_instruments")
    .select(PORTFOLIO_VALUE_SELECT)
    .order("created_at", { ascending: true })
    .order("valued_on", { referencedTable: "portfolio_valuations", ascending: false })
    .limit(1, { referencedTable: "portfolio_valuations" })
    .order("trade_date", { referencedTable: "portfolio_transactions", ascending: true })
    .order("created_at", { referencedTable: "portfolio_transactions", ascending: true });

  const valued = await valuePortfolio(supabase, (data ?? []) as unknown as ValuableInstrument[], todayInSaoPaulo());
  const allPositions = valued.map((item) => ({
    instrument: item.instrument,
    terms: item.terms,
    resolved: item.resolved,
    quantity: item.position.quantity,
    currentValueCents: item.resolved.valueCents as bigint | null,
    costBasisCents: item.position.costBasisCents,
  }));
  const positions = allPositions.filter((position) => position.quantity > 0n);
  const closedPositions = allPositions.filter((position) => position.quantity === 0n);
  const hasEstimate = positions.some((position) => position.resolved.estimated);

  const totalCents = positions.reduce(
    (total, position) => total + (position.currentValueCents ?? position.costBasisCents),
    0n,
  );

  const grouped = positions.reduce<Record<string, typeof positions>>((result, position) => {
    (result[position.instrument.asset_class] ??= []).push(position);
    return result;
  }, {});

  return <AppShell active="/carteira">
    <div className="portfolio-summary">
      <div>
        <p className="eyebrow">Carteira · manual</p>
        <h1>{hasEstimate ? "≈ " : ""}{formatMoneyFromCents(totalCents)}</h1>
        <p>Posição calculada pelo seu histórico</p>
      </div>
      <Link className="portfolio-add" href="/carteira/novo">+ Ativo</Link>
    </div>

    {allPositions.length === 0 ? <section className="section empty-card">
      <h2>Sua carteira começa aqui</h2>
      <p>Adicione uma compra para acompanhar seus ativos com valores reais, sem números ilustrativos.</p>
      <Link className="button" href="/carteira/novo">Adicionar primeiro ativo</Link>
    </section> : <>
      <section className="portfolio-value-card">
        <div><span>Valor atual informado</span><strong>{formatMoneyFromCents(totalCents)}</strong></div>
        <p>A rentabilidade aparecerá quando houver histórico suficiente. Nenhuma estimativa é inventada.</p>
      </section>
      <div className="portfolio-groups">
        {Object.entries(grouped).map(([assetClass, items]) => {
          const classTotal = items.reduce(
            (total, item) => total + (item.currentValueCents ?? item.costBasisCents),
            0n,
          );
          const percentage = totalCents === 0n ? 0 : Number((classTotal * 1000n) / totalCents) / 10;
          return <section key={assetClass}>
            <header style={{ background: classes[assetClass]?.color }}>
              <span>{classes[assetClass]?.label ?? "Outros"} <small>{percentage.toLocaleString("pt-BR")}%</small></span>
              <strong>{formatMoneyFromCents(classTotal)}</strong>
            </header>
            {items.map(({ instrument, terms, resolved, quantity, currentValueCents, costBasisCents }) => {
              const balance = isBalanceProduct(terms?.product_type);
              const priceLabel = valueSourceLabel(resolved);
              return <Link className="portfolio-item" href={`/carteira/${instrument.id}`} key={instrument.id}>
                <div><strong>{instrument.symbol}</strong><span>{instrument.name}{balance ? "" : ` · ${formatQuantity(quantity)} ${terms?.product_type?.startsWith("tesouro") ? "títulos" : "cotas"}`}</span></div>
                <div><strong>{resolved.estimated ? "≈ " : ""}{formatMoneyFromCents(currentValueCents ?? costBasisCents)}</strong><span>{instrument.portfolio_institutions?.name} · {priceLabel}</span></div>
              </Link>;
            })}
          </section>;
        })}
      </div>
      {closedPositions.length > 0 ? <section className="closed-positions">
        <p className="eyebrow">Posições encerradas</p>
        {closedPositions.map(({ instrument }) => <Link href={`/carteira/${instrument.id}`} key={instrument.id}>
          <span><strong>{instrument.symbol}</strong>{instrument.name}</span><span>Ver histórico →</span>
        </Link>)}
      </section> : null}
    </>}

    <p className="status-note">Cada valor mostra a origem e a data do preço: fechamento de mercado, valor informado por você ou o preço do último lançamento. {hasEstimate ? ESTIMATE_DISCLAIMER : ""}</p>
  </AppShell>;
}
