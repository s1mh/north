begin;

-- Fase 5c: preço de mercado na carteira.

-- Último preço de cada instrumento de mercado (B3 e Tesouro), para a carteira ler de uma vez.
create or replace view public.market_latest_prices
with (security_invoker = true) as
select distinct on (p.instrument_id)
  p.instrument_id,
  i.source_id,
  i.source_instrument_id,
  i.symbol,
  i.name,
  i.market,
  p.observed_at,
  p.close,
  p.currency
from public.market_prices p
join public.market_instruments i on i.id = p.instrument_id
where i.active
order by p.instrument_id, p.observed_at desc;

revoke all on public.market_latest_prices from anon, authenticated;
grant select on public.market_latest_prices to authenticated;

create index if not exists market_instruments_symbol_idx on public.market_instruments(symbol);

-- Títulos do Tesouro Direto na ficha (liga o ativo ao preço do título).
alter table public.portfolio_instrument_terms drop constraint if exists portfolio_instrument_terms_product_type_check;
alter table public.portfolio_instrument_terms add constraint portfolio_instrument_terms_product_type_check check (
  product_type is null or product_type in (
    'rdb', 'cdb', 'lci', 'lca', 'lc', 'conta_remunerada', 'poupanca', 'tesouro',
    'tesouro_selic', 'tesouro_pre', 'tesouro_pre_js', 'tesouro_ipca', 'tesouro_ipca_js',
    'tesouro_renda', 'tesouro_educa',
    'fundo', 'previdencia', 'debenture', 'cri', 'cra', 'outro'
  )
);

commit;
