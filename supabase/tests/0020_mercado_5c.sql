begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mkt-a@example.test', '', now(),
 '{"display_name":"Ana","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb, now(), now());

insert into public.market_instruments (id, source_id, source_instrument_id, symbol, name, asset_class, currency, market)
values
('20000000-0000-0000-0000-000000000001', 'b3-public-eod', 'PETR4-teste', 'PETR4', 'Petrobras PN', 'b3_listed', 'BRL', 'B3'),
('20000000-0000-0000-0000-000000000002', 'tesouro-transparente', 'Tesouro Selic|2031-03-01', 'SELIC-2031-03-01', 'Tesouro Selic 2031', 'tesouro_direto', 'BRL', 'Tesouro Direto');
insert into public.market_prices (instrument_id, source_id, observed_at, currency, close) values
('20000000-0000-0000-0000-000000000001', 'b3-public-eod', '2026-11-12T23:00:00Z', 'BRL', 34.00),
('20000000-0000-0000-0000-000000000001', 'b3-public-eod', '2026-11-13T23:00:00Z', 'BRL', 35.50),
('20000000-0000-0000-0000-000000000002', 'tesouro-transparente', '2026-11-13T23:00:00Z', 'BRL', 20192.26);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000061","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000061', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.market_latest_prices), 2::bigint, 'a view traz um preço por instrumento');
select is((select close from public.market_latest_prices where symbol = 'PETR4'), 35.50::numeric, 'e é o mais recente');
select is((select observed_at::date from public.market_latest_prices where symbol = 'PETR4'), '2026-11-13'::date, 'com a data do fechamento');
select is((select close from public.market_latest_prices where source_instrument_id = 'Tesouro Selic|2031-03-01'), 20192.26::numeric, 'o Tesouro é encontrado por tipo + vencimento');

-- ficha aceita os títulos do Tesouro e continua recusando tipos inventados
create temp table t_inst as
  select public.create_portfolio_asset('Tesouro Direto', 'SELIC2031', 'Tesouro Selic 2031', 'renda_fixa', 0.5, 19500, 0, '2026-09-01') as id;
grant all on t_inst to authenticated;
select lives_ok(
  $$ select public.set_instrument_terms((select id from t_inst), '{"product_type":"tesouro_selic","maturity_date":"2031-03-01"}'::jsonb) $$,
  'aceita Tesouro Selic na ficha'
);
select lives_ok(
  $$ select public.set_instrument_terms((select id from t_inst), '{"product_type":"tesouro_ipca_js"}'::jsonb) $$,
  'aceita Tesouro IPCA+ com juros semestrais'
);
select throws_ok(
  $$ select public.set_instrument_terms((select id from t_inst), '{"product_type":"tesouro_banana"}'::jsonb) $$,
  '23514', null, 'recusa tipo inventado'
);

-- anônimo não lê a view
set local role anon;
select throws_ok($$ select count(*) from public.market_latest_prices $$, '42501', null, 'visitante sem login não lê preços');

select * from finish();
rollback;
