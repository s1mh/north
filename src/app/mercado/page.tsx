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
  const indicators = error
    ? []
    : latestIndicators((data ?? []) as unknown as MarketIndicatorRow[]);
  const newestDate = indicators[0]?.observed_on;

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
      <h2>Conexão licenciada em preparação</h2>
      <p>Ações, fundos, índices e cripto serão exibidos somente depois que a fonte permitir uso no produto. O North não raspa cotações de páginas públicas.</p>
    </section>
    <p className="status-note">Selic e IPCA: Banco Central do Brasil. A data observada é exibida em cada registro; “desatualizado” aparece quando a frequência esperada é ultrapassada.</p>
  </AppShell>;
}
