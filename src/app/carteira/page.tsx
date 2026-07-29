import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  derivePosition,
  formatMoneyFromCents,
  formatQuantity,
  getPriceStatus,
  type PortfolioTransaction,
} from "@/features/portfolio/ledger";
import { createClient } from "@/server/supabase/client";

type Instrument = {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  latest_price: string | number | null;
  price_observed_at: string | null;
  portfolio_institutions: { name: string } | null;
  portfolio_transactions: PortfolioTransaction[];
};

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
    .select(`
      id, symbol, name, asset_class, latest_price, price_observed_at,
      portfolio_institutions(name),
      portfolio_transactions(
        id, transaction_type, quantity, unit_price, fees, cash_amount,
        reverses_transaction_id, corrects_transaction_id, audit_reason,
        trade_date, created_at
      )
    `)
    .order("created_at", { ascending: true })
    .order("trade_date", { referencedTable: "portfolio_transactions", ascending: true })
    .order("created_at", { referencedTable: "portfolio_transactions", ascending: true });

  const allPositions = ((data ?? []) as unknown as Instrument[]).map((instrument) => ({
    instrument,
    ...derivePosition(instrument.portfolio_transactions, instrument.latest_price),
  }));
  const positions = allPositions.filter((position) => position.quantity > 0n);
  const closedPositions = allPositions.filter((position) => position.quantity === 0n);

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
        <h1>{formatMoneyFromCents(totalCents)}</h1>
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
            {items.map(({ instrument, quantity, currentValueCents, costBasisCents }) => {
              const observed = instrument.price_observed_at
                ? new Intl.DateTimeFormat("pt-BR").format(new Date(instrument.price_observed_at))
                : null;
              const priceStatus = getPriceStatus(instrument.latest_price, instrument.price_observed_at);
              const priceLabel = priceStatus === "missing"
                ? "sem preço atual"
                : priceStatus === "stale"
                  ? `preço desatualizado · ${observed}`
                  : `preço de ${observed}`;
              return <Link className="portfolio-item" href={`/carteira/${instrument.id}`} key={instrument.id}>
                <div><strong>{instrument.symbol}</strong><span>{instrument.name} · {formatQuantity(quantity)} cotas</span></div>
                <div><strong>{formatMoneyFromCents(currentValueCents ?? costBasisCents)}</strong><span>{instrument.portfolio_institutions?.name} · {priceLabel}</span></div>
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

    <p className="status-note">Valores factuais vêm das movimentações registradas por você. O preço manual sempre exibe sua data; futuras cotações mostrarão também a fonte.</p>
  </AppShell>;
}
