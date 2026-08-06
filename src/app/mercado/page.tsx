import { AppShell } from "@/components/app-shell";
import {
  formatIndicatorValue,
  formatObservedDate,
  isIndicatorStale,
  latestIndicators,
  type MarketIndicatorRow,
} from "@/features/market/presentation";
import type { BrapiQuote } from "@/features/market/brapi";
import { getBrapiQuotes } from "@/server/market/brapi-quotes";
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

type DisplayQuote = {
  symbol: string;
  name: string;
  close: string | number;
  high: string | number | null;
  low: string | number | null;
  observedAt: string;
  changePercent: number | null;
  source: "brapi" | "b3";
};

const DEFAULT_QUOTE_SYMBOLS = ["PETR4", "VALE3", "ITUB4", "B3SA3", "WEGE3", "MGLU3"];

function formatPrice(value: string | number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatChange(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatQuoteTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function displayBrapiQuote(quote: BrapiQuote): DisplayQuote {
  return {
    symbol: quote.symbol,
    name: quote.name,
    close: quote.close,
    high: quote.high,
    low: quote.low,
    observedAt: quote.observedAt,
    changePercent: quote.changePercent,
    source: "brapi",
  };
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
  const latestB3Quotes = Array.from(quoteRows.reduce((latest, row) => {
    const symbol = row.market_instruments?.symbol;
    if (symbol && !latest.has(symbol)) latest.set(symbol, row);
    return latest;
  }, new Map<string, MarketPriceRow>()).values()).slice(0, 8);
  const quoteSymbols = Array.from(new Set([
    ...DEFAULT_QUOTE_SYMBOLS,
    ...latestB3Quotes.flatMap((quote) => quote.market_instruments?.symbol ?? []),
  ])).slice(0, 8);
  const brapiQuotes = await getBrapiQuotes(quoteSymbols);
  const brapiBySymbol = new Map(brapiQuotes.map((quote) => [quote.symbol, quote]));
  const b3BySymbol = new Map(latestB3Quotes.flatMap((quote) => {
    const instrument = quote.market_instruments;
    if (!instrument) return [];
    return [[instrument.symbol, quote] as const];
  }));
  const quotes: DisplayQuote[] = quoteSymbols.flatMap((symbol) => {
    const live = brapiBySymbol.get(symbol);
    if (live) return [displayBrapiQuote(live)];
    const fallback = b3BySymbol.get(symbol);
    if (!fallback?.market_instruments) return [];
    return [{
      symbol,
      name: fallback.market_instruments.name,
      close: fallback.close,
      high: fallback.high,
      low: fallback.low,
      observedAt: fallback.observed_at,
      changePercent: null,
      source: "b3" as const,
    }];
  });
  const hasBrapiQuotes = quotes.some((quote) => quote.source === "brapi");

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
      <h2>{hasBrapiQuotes ? "Cotações com atraso" : "Fechamento público D‑1 da B3"}</h2>
      {quotes.length > 0 ? <div className="market-quotes-grid">
        {quotes.map((quote) => <article key={quote.symbol}>
          <div><strong>{quote.symbol}</strong><span>{quote.name}</span></div>
          <b>{formatPrice(quote.close)}</b>
          {quote.changePercent !== null ? <em data-direction={quote.changePercent >= 0 ? "up" : "down"}>
            {formatChange(quote.changePercent)} no dia
          </em> : null}
          <dl>
            <div><dt>Mín.</dt><dd>{formatPrice(quote.low)}</dd></div>
            <div><dt>Máx.</dt><dd>{formatPrice(quote.high)}</dd></div>
          </dl>
          <small>{quote.source === "brapi"
            ? `brapi · atualização de ${formatQuoteTime(quote.observedAt)}`
            : `B3 · fechamento de ${formatObservedDate(quote.observedAt.slice(0, 10))}`}</small>
        </article>)}
      </div> : <p>A coleta dos preços individuais está pronta e aparecerá aqui após a próxima rotina diária. Nenhum valor ilustrativo será usado.</p>}
      <p>{hasBrapiQuotes
        ? "Plano gratuito da brapi: atraso aproximado de 30 minutos e cache do North por 30 minutos. Não use como cotação em tempo real."
        : "Dados gratuitos publicados após o fechamento. Não são cotações em tempo real."}</p>
    </section>
    <p className="status-note">Selic e IPCA: Banco Central do Brasil. Ibovespa: arquivo oficial D‑1 da B3. Ativos listados: brapi com atraso e B3 D‑1 como contingência. A data observada é exibida em cada registro.</p>
  </AppShell>;
}
