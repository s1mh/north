import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  derivePosition,
  formatMoneyFromCents,
  formatQuantity,
  transactionValueCents,
  type PortfolioTransaction,
} from "@/features/portfolio/ledger";
import { createClient } from "@/server/supabase/client";

type DetailedTransaction = PortfolioTransaction & {
  id: string;
  trade_date: string;
  created_at: string;
};

type Instrument = {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  latest_price: string | number | null;
  price_observed_at: string | null;
  portfolio_institutions: { name: string } | null;
  portfolio_transactions: DetailedTransaction[];
};

const classLabels: Record<string, string> = {
  renda_fixa: "Renda fixa",
  acoes: "Ações B3",
  fundos: "Fundos",
  fiis: "FIIs",
  internacional: "Internacional",
  cripto: "Cripto",
  outros: "Outros",
};

const transactionLabels: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  aporte: "Aporte",
  resgate: "Resgate",
  rendimento: "Rendimento",
  taxa: "Taxa",
  ajuste: "Ajuste",
};

function formatTradeDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export const dynamic = "force-dynamic";

export default async function PortfolioInstrumentPage({
  params,
}: {
  params: Promise<{ instrumentId: string }>;
}) {
  const { instrumentId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_instruments")
    .select(`
      id, symbol, name, asset_class, latest_price, price_observed_at,
      portfolio_institutions(name),
      portfolio_transactions(id, transaction_type, quantity, unit_price, fees, cash_amount, trade_date, created_at)
    `)
    .eq("id", instrumentId)
    .order("trade_date", { referencedTable: "portfolio_transactions", ascending: false })
    .order("created_at", { referencedTable: "portfolio_transactions", ascending: false })
    .maybeSingle();

  if (!data) notFound();
  const instrument = data as unknown as Instrument;
  const chronological = [...instrument.portfolio_transactions].reverse();
  const position = derivePosition(chronological, instrument.latest_price);
  const currentValue = position.currentValueCents ?? position.costBasisCents;
  const observed = instrument.price_observed_at
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(instrument.price_observed_at))
    : null;

  return <AppShell active="/carteira">
    <div className="instrument-head">
      <Link href="/carteira" aria-label="Voltar para a carteira">←</Link>
      <div>
        <p className="eyebrow">{classLabels[instrument.asset_class]} · {instrument.portfolio_institutions?.name}</p>
        <h1>{instrument.symbol}</h1>
        <p>{instrument.name}</p>
      </div>
      <Link className="portfolio-add" href={`/carteira/${instrument.id}/movimentar`}>+ Movimento</Link>
    </div>

    <section className="instrument-position">
      <div><span>Valor atual</span><strong>{formatMoneyFromCents(currentValue)}</strong></div>
      <dl>
        <div><dt>Quantidade</dt><dd>{formatQuantity(position.quantity)}</dd></div>
        <div><dt>Custo da posição</dt><dd>{formatMoneyFromCents(position.costBasisCents)}</dd></div>
        <div><dt>Rendimentos</dt><dd>{formatMoneyFromCents(position.incomeCents)}</dd></div>
        <div><dt>Taxas avulsas</dt><dd>{formatMoneyFromCents(position.expenseCents)}</dd></div>
      </dl>
      <p>{observed ? `Último preço informado em ${observed}.` : "Sem preço atual informado."}</p>
    </section>

    <section className="transaction-history">
      <div className="section-head"><div><p className="eyebrow">Livro imutável</p><h2>Movimentações</h2></div></div>
      <div>
        {instrument.portfolio_transactions.map((transaction) => {
          const outgoing = ["venda", "resgate", "taxa"].includes(transaction.transaction_type);
          return <article key={transaction.id}>
            <span className="transaction-mark" data-outgoing={outgoing}>{outgoing ? "−" : "+"}</span>
            <div>
              <strong>{transactionLabels[transaction.transaction_type]}</strong>
              <span>{formatTradeDate(transaction.trade_date)}{Number(transaction.quantity) !== 0 ? ` · ${String(transaction.quantity).replace(".", ",")} cotas` : ""}</span>
            </div>
            <strong>{outgoing ? "−" : ""}{formatMoneyFromCents(transactionValueCents(transaction))}</strong>
          </article>;
        })}
      </div>
    </section>
  </AppShell>;
}
