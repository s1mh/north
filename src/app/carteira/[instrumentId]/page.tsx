import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  derivePosition,
  formatMoneyFromCents,
  formatQuantity,
  getPriceStatus,
  transactionValueCents,
  type PortfolioTransaction,
} from "@/features/portfolio/ledger";
import { InstrumentValue } from "@/features/portfolio/instrument-value";
import { TermsCard } from "@/features/portfolio/terms-card";
import { isBalanceProduct, type InstrumentTerms } from "@/features/portfolio/terms";
import { todayInSaoPaulo } from "@/features/portfolio/submission";
import { daysBetween, gainFromCents } from "@/features/portfolio/valuation";
import { ESTIMATE_DISCLAIMER, valueSourceLabel } from "@/features/portfolio/value";
import { estimateInstrument } from "@/server/estimates/instrument";
import { PORTFOLIO_VALUE_SELECT, valuePortfolio, type ValuableInstrument } from "@/server/portfolio/values";
import { createClient } from "@/server/supabase/client";

type DetailedTransaction = PortfolioTransaction & {
  id: string;
  trade_date: string;
  created_at: string;
  reverses_transaction_id: string | null;
  corrects_transaction_id: string | null;
  audit_reason: string | null;
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
  const [{ data: termsRow }, { data: valuationRow }] = await Promise.all([
    supabase.from("portfolio_instrument_terms").select("*").eq("instrument_id", instrumentId).maybeSingle(),
    supabase
      .from("portfolio_valuations")
      .select("valued_on, source")
      .eq("instrument_id", instrumentId)
      .order("valued_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const terms = (termsRow ?? null) as unknown as InstrumentTerms | null;
  const lastValuation = (valuationRow ?? null) as { valued_on: string; source: string } | null;
  const { data } = await supabase
    .from("portfolio_instruments")
    .select(PORTFOLIO_VALUE_SELECT)
    .eq("id", instrumentId)
    .order("valued_on", { referencedTable: "portfolio_valuations", ascending: false })
    .limit(1, { referencedTable: "portfolio_valuations" })
    .order("trade_date", { referencedTable: "portfolio_transactions", ascending: false })
    .order("created_at", { referencedTable: "portfolio_transactions", ascending: false })
    .maybeSingle();

  if (!data) notFound();
  const instrument = data as unknown as Instrument;
  const chronological = [...instrument.portfolio_transactions].reverse();
  const position = derivePosition(chronological, instrument.latest_price);
  const [valued] = await valuePortfolio(
    supabase,
    [{ ...(data as unknown as ValuableInstrument), portfolio_transactions: chronological } as ValuableInstrument],
    todayInSaoPaulo(),
  );
  const resolved = valued!.resolved;
  const currentValue = resolved.valueCents;
  const observed = instrument.price_observed_at
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(instrument.price_observed_at))
    : null;
  const priceStatus = getPriceStatus(instrument.latest_price, instrument.price_observed_at);
  const today = todayInSaoPaulo();
  const estimate = await estimateInstrument({
    transactions: instrument.portfolio_transactions,
    terms,
    asOf: today,
    informedOn: lastValuation?.valued_on ?? null,
  });
  const balance = isBalanceProduct(terms?.product_type);
  const hasInformedValue = Boolean(lastValuation);
  const rawGain = resolved.source === "custo" ? null : gainFromCents(position.costBasisCents, currentValue);
  // Só mostra ganho quando há valor informado, preço de mercado, estimativa ou o preço realmente difere do custo.
  const gain = rawGain && (hasInformedValue || resolved.source !== "lancamento" || rawGain.gainCents !== 0n) ? rawGain : null;
  const informedToday = lastValuation && instrument.price_observed_at
    && lastValuation.valued_on === instrument.price_observed_at.slice(0, 10);
  const informedAge = lastValuation ? daysBetween(lastValuation.valued_on) : 0;
  const informedValueCents = lastValuation && informedToday && resolved.source === "informado" ? currentValue : null;
  const money = formatMoneyFromCents;
  const reversedIds = new Set(
    instrument.portfolio_transactions
      .map((transaction) => transaction.reverses_transaction_id)
      .filter((id): id is string => Boolean(id)),
  );

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
      <div><span>Valor atual</span><strong>{resolved.estimated ? "≈ " : ""}{formatMoneyFromCents(currentValue)}</strong></div>
      {gain && position.costBasisCents > 0n ? <p className="instrument-gain" data-negative={gain.gainCents < 0n}>
        {gain.gainCents >= 0n ? "+" : ""}{money(gain.gainCents)}
        {gain.percent !== null ? ` (${gain.percent >= 0 ? "+" : ""}${gain.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : ""}
        <small> sobre o que você colocou</small>
      </p> : null}
      <dl>
        {!balance ? <div><dt>Quantidade</dt><dd>{formatQuantity(position.quantity)}</dd></div> : null}
        <div><dt>{balance ? "Você colocou" : "Custo da posição"}</dt><dd>{formatMoneyFromCents(position.costBasisCents)}</dd></div>
        <div><dt>Rendimentos lançados</dt><dd>{formatMoneyFromCents(position.incomeCents)}</dd></div>
        <div><dt>Taxas avulsas</dt><dd>{formatMoneyFromCents(position.expenseCents)}</dd></div>
      </dl>
      <p data-price-status={resolved.stale ? "stale" : resolved.source === "lancamento" ? priceStatus : "informed"}>
        {resolved.source === "mercado" || resolved.source === "tesouro"
          ? `Preço de ${resolved.source === "tesouro" ? "venda do Tesouro" : "mercado (fechamento)"} de ${formatTradeDate(resolved.asOf!)}${resolved.source === "tesouro" ? " · Tesouro Transparente" : " · B3"}${resolved.stale ? ". Está desatualizado: confira com a sua corretora." : "."}`
          : resolved.source === "estimado_ancorado" || resolved.source === "estimado_contrato"
            ? `${valueSourceLabel(resolved)}. ${ESTIMATE_DISCLAIMER}`
            : informedToday
              ? `Valor informado por você em ${formatTradeDate(lastValuation!.valued_on)}${informedAge > 0 ? ` (há ${informedAge} ${informedAge === 1 ? "dia" : "dias"})` : ""}. O north. não consulta o banco: atualize quando quiser.`
              : priceStatus === "missing"
                ? "Sem preço atual informado; o valor usa o custo da posição."
                : priceStatus === "stale"
                  ? `Preço do último lançamento, de ${observed}. Atualize o valor para ver o ganho de hoje.`
                  : `Preço do último lançamento, de ${observed}.`}
      </p>
      <InstrumentValue instrumentId={instrument.id} today={today} />
    </section>

    {estimate ? <section className="estimate-card" aria-labelledby="estimate-title">
      <p className="eyebrow">Estimativa pelo contrato · {estimate.rateText}</p>
      <h2 id="estimate-title">
        ≈ {money(BigInt(Math.round((estimate.net ?? estimate.gross) * 100)))}
        <small>{estimate.net !== null ? " líquido estimado hoje" : " bruto estimado hoje (antes de impostos)"}</small>
      </h2>
      <dl>
        <div><dt>Rendimento bruto estimado</dt><dd>{money(BigInt(Math.round((estimate.gross - estimate.principal) * 100)))}</dd></div>
        {estimate.regime === "isento"
          ? <div><dt>Imposto de renda</dt><dd>Isento (pessoa física)</dd></div>
          : estimate.taxes !== null
            ? <div><dt>Impostos estimados (IR{estimate.taxes > 0 ? " e IOF, se houver" : ""})</dt><dd>−{money(BigInt(Math.round(estimate.taxes * 100)))}</dd></div>
            : null}
        {estimate.atInformed && informedValueCents !== null ? <div>
          <dt>Em {formatTradeDate(estimate.atInformed.date)}: estimado × informado</dt>
          <dd>{money(BigInt(Math.round((estimate.atInformed.net ?? estimate.atInformed.gross) * 100)))} × {money(informedValueCents)}</dd>
        </div> : null}
      </dl>
      <p className="estimate-note">
        Calculado com o {terms?.indexer === "selic_pct" ? "Selic" : "CDI"} do Banco Central até {formatTradeDate(estimate.throughDate)}
        ({estimate.businessDays} dias úteis). É uma estimativa, não o valor do seu banco: pequenas diferenças de dias e arredondamento são normais, e o valor que vale na carteira é o que você informa.
      </p>
    </section> : null}

    <TermsCard instrumentId={instrument.id} terms={terms} today={today} />

    <section className="transaction-history">
      <div className="section-head"><div><p className="eyebrow">Livro imutável</p><h2>Movimentações</h2></div></div>
      <div>
        {instrument.portfolio_transactions.map((transaction) => {
          const reversal = Boolean(transaction.reverses_transaction_id);
          const originalReversed = reversedIds.has(transaction.id);
          const baseOutgoing = ["venda", "resgate", "taxa"].includes(transaction.transaction_type);
          const outgoing = reversal ? !baseOutgoing : baseOutgoing;
          const baseLabel = transactionLabels[transaction.transaction_type] ?? "Movimentação";
          const label = reversal
            ? `Estorno de ${baseLabel.toLocaleLowerCase("pt-BR")}`
            : transaction.corrects_transaction_id
              ? `${baseLabel} corrigida`
              : originalReversed
                ? `${baseLabel} original`
                : baseLabel;
          return <article key={transaction.id}>
            <span className="transaction-mark" data-outgoing={outgoing}>{outgoing ? "−" : "+"}</span>
            <div>
              <strong>{label}</strong>
              <span>{formatTradeDate(transaction.trade_date)}{!balance && Number(transaction.quantity) !== 0 ? ` · ${String(transaction.quantity).replace(".", ",")} cotas` : ""}</span>
              {transaction.audit_reason ? <small>{transaction.audit_reason}</small> : null}
            </div>
            <div className="transaction-actions">
              <strong>{outgoing ? "−" : ""}{formatMoneyFromCents(transactionValueCents(transaction))}</strong>
              {!reversal && !originalReversed ? <Link href={`/carteira/${instrument.id}/movimentacoes/${transaction.id}/corrigir`}>Corrigir</Link> : null}
            </div>
          </article>;
        })}
      </div>
    </section>
  </AppShell>;
}
