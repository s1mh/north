begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(23);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pos-a@example.test', '', now(),
 '{"display_name":"Ana","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb, now(), now()),
('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pos-b@example.test', '', now(),
 '{"display_name":"Beto","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb, now(), now());

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values ('10000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000052', 'App', 'totp', 'verified', now(), now(), 'x');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table t_inst as
  select public.create_portfolio_asset('Nubank', 'TURBO', 'Caixinha Turbo', 'renda_fixa', 500, 1, 0,
    ((now() at time zone 'America/Sao_Paulo')::date - 30)) as id;
grant all on t_inst to authenticated;

select is(public.instrument_quantity((select id from t_inst)), 500.00000000::numeric, 'quantidade atual do ativo');

-- valor informado
select is(
  (public.record_instrument_valuation((select id from t_inst), 507.39, (now() at time zone 'America/Sao_Paulo')::date) ->> 'unit_price')::numeric,
  1.01478::numeric, 'preço implícito = total / quantidade'
);
select is((select latest_price from public.portfolio_instruments where id = (select id from t_inst)), 1.014780::numeric, 'preço atual do ativo atualizado');
select is((select count(*) from public.portfolio_valuations), 1::bigint, 'série guarda a marcação');

select lives_ok(
  $$ select public.record_instrument_valuation((select id from t_inst), 508.00, (now() at time zone 'America/Sao_Paulo')::date) $$,
  'informar de novo no mesmo dia'
);
select is((select count(*) from public.portfolio_valuations), 1::bigint, 'o mesmo dia substitui, não duplica');
select is((select total_value from public.portfolio_valuations), 508.00::numeric, 'vale o último valor informado');

select throws_ok(
  $$ select public.record_instrument_valuation((select id from t_inst), 500, (now() at time zone 'America/Sao_Paulo')::date + 1) $$,
  '22023', 'invalid valuation', 'data futura é recusada'
);
select throws_ok(
  $$ select public.record_instrument_valuation((select id from t_inst), 0, (now() at time zone 'America/Sao_Paulo')::date) $$,
  '22023', 'invalid valuation', 'valor zero é recusado'
);
select throws_ok(
  $$ select public.record_instrument_valuation((select id from t_inst), 500, (now() at time zone 'America/Sao_Paulo')::date - 60) $$,
  '22023', 'valuation before first trade', 'antes do primeiro lançamento é recusado'
);

-- desfazer
select lives_ok(
  $$ select public.restore_instrument_valuation((select id from t_inst), (now() at time zone 'America/Sao_Paulo')::date, 1, null) $$,
  'restaura o preço anterior'
);
select is((select count(*) from public.portfolio_valuations), 0::bigint, 'a marcação desfeita some da série');
select is((select latest_price from public.portfolio_instruments where id = (select id from t_inst)), 1.000000::numeric, 'preço volta ao anterior');

-- ficha
select is(
  (public.set_instrument_terms((select id from t_inst), '{"product_type":"rdb","issuer":"Nu Financeira","indexer":"cdi_pct","rate":120,"fgc":"sim","liquidity":"diaria"}'::jsonb) -> 'current' ->> 'rate')::numeric,
  120.0000::numeric, 'cria a ficha'
);
select is(
  public.set_instrument_terms((select id from t_inst), '{"maturity_date":"2028-09-29"}'::jsonb) -> 'current' ->> 'issuer',
  'Nu Financeira', 'campos ausentes mantêm o valor'
);
select is(
  public.set_instrument_terms((select id from t_inst), '{"issuer":null}'::jsonb) -> 'current' ->> 'issuer',
  null, 'JSON null limpa o campo'
);
select throws_ok(
  $$ select public.set_instrument_terms((select id from t_inst), '{"preco":1}'::jsonb) $$,
  '22023', 'invalid terms', 'campo desconhecido é recusado'
);
select throws_ok(
  $$ select public.set_instrument_terms((select id from t_inst), '{"indexer":"banana"}'::jsonb) $$,
  '23514', null, 'valor fora da lista é recusado'
);
select lives_ok($$ select public.restore_instrument_terms((select id from t_inst), null) $$, 'restaurar sem ficha anterior remove a ficha');
select is((select count(*) from public.portfolio_instrument_terms), 0::bigint, 'ficha removida');

-- isolamento
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated","aal":"aal2"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', true);
select throws_ok(
  $$ select public.record_instrument_valuation((select id from t_inst), 600, (now() at time zone 'America/Sao_Paulo')::date) $$,
  '42501', 'instrument not available', 'não informa valor de ativo de outra pessoa'
);
select throws_ok(
  $$ select public.set_instrument_terms((select id from t_inst), '{"issuer":"Hack"}'::jsonb) $$,
  '42501', 'instrument not available', 'não altera ficha de outra pessoa'
);

-- 2FA
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$ select public.record_instrument_valuation((select id from t_inst), 600, (now() at time zone 'America/Sao_Paulo')::date) $$,
  '42501', 'mfa_required', 'sem segundo fator na sessão, escrita é recusada'
);

select * from finish();
rollback;
