import { AppShell } from "@/components/app-shell";
import {
  formatIndicatorValue,
  formatObservedDate,
  isIndicatorStale,
  latestIndicators,
  type MarketIndicatorRow,
} from "@/features/market/presentation";
import { createClient } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

type MarketPriceRow = {
  close: string | number;
  open: string | number | null;
  high: string | number | null;
  low: string | number | null;
  observed_at: string;
  market_instruments: { symbol: string; name: string } | null;
};

function formatPrice(value: string | number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default async function MercadoPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_indicators")
    .select(`
      code, label, value, unit, observed_on, fetched_at,
      market_data_sources(display_name, attribution)
    `)
    .order("observed_on", { ascending: false })
    .limit(12);
  const { data: priceData, error: priceError } = await supabase
    .from("market_prices")
    .select(`
      close, open, high, low, observed_at,
      market_instruments!inner(symbol,name)
    `)
    .order("observed_at", { ascending: false })
    .limit(60);
  const indicators = error
    ? []
    : latestIndicators((data ?? []) as unknown as MarketIndicatorRow[]);
  const newestDate = indicators[0]?.observed_on;
  const quoteRows = priceError ? [] : (priceData ?? []) as unknown as MarketPriceRow[];
  const quotes = Array.from(quoteRows.reduce((latest, row) => {
    const symbol = row.market_instruments?.symbol;
    if (symbol && !latest.has(symbol)) latest.set(symbol, row);
    return latest;
  }, new Map<string, MarketPriceRow>()).values()).slice(0, 8);

  return <AppShell active="/mercado">
    <div className="market-heading">
      <p className="eyebrow">Mercado</p>
      <span>{newestDate ? `dados até ${formatObservedDate(newestDate)}` : "aguardando dados"}</span>
    </div>
    <h1 className="market-title">Fechamento</h1>

    {indicators.length > 0 ? <>
      <div className="market-grid">
        {indicators.map((indicator) => {
          const stale = isIndicatorStale(indicator);
          return <article className="market-card" key={indicator.code}>
            <p>{indicator.label}</p>
            <strong>{formatIndicatorValue(indicator)}</strong>
            <span data-stale={stale}>{stale ? "Dado desatualizado" : "Último dado oficial"}</span>
          </article>;
        })}
      </div>
      <section className="market-provenance">
        <p className="eyebrow">Procedência</p>
        {indicators.map((indicator) => <div key={indicator.code}>
          <strong>{indicator.label}</strong>
          <span>
            {indicator.market_data_sources?.attribution ?? "Fonte não informada"}
            {" · "}{formatObservedDate(indicator.observed_on)}
          </span>
        </div>)}
      </section>
    </> : <section className="section empty-card">
      <h2>Aguardando o primeiro fechamento</h2>
      <p>A rotina diária ainda não armazenou indicadores. Nenhum valor ilustrativo será usado no lugar deles.</p>
    </section>}

    <section className="section market-license-note">
      <p className="eyebrow">Cotações de ativos</p>
      <h2>Fechamento público D‑1 da B3</h2>
      {quotes.length > 0 ? <div className="market-quotes-grid">
        {quotes.map((quote) => <article key={quote.market_instruments!.symbol}>
          <div><strong>{quote.market_instruments!.symbol}</strong><span>{quote.market_instruments!.name}</span></div>
          <b>{formatPrice(quote.close)}</b>
          <dl>
            <div><dt>Mín.</dt><dd>{formatPrice(quote.low)}</dd></div>
            <div><dt>Máx.</dt><dd>{formatPrice(quote.high)}</dd></div>
          </dl>
          <small>Fechamento de {formatObservedDate(quote.observed_at.slice(0, 10))}</small>
        </article>)}
      </div> : <p>A coleta dos preços individuais está pronta e aparecerá aqui após a próxima rotina diária. Nenhum valor ilustrativo será usado.</p>}
      <p>Dados gratuitos publicados após o fechamento. Não são cotações em tempo real.</p>
    </section>
    <p className="status-note">Selic e IPCA: Banco Central do Brasil. Ibovespa e ativos listados: arquivos oficiais D‑1 da B3. A data observada é exibida em cada registro.</p>
  </AppShell>;
}
