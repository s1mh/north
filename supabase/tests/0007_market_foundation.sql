begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(22);

select has_table('public'::name, 'market_data_sources'::name);
select has_table('public'::name, 'market_indicators'::name);
select has_table('public'::name, 'market_instruments'::name);
select has_table('public'::name, 'market_prices'::name);
select has_table('public'::name, 'market_ingestion_runs'::name);
select has_table('public'::name, 'market_data_alerts'::name);
select ok(
  has_table_privilege('service_role', 'public.market_ingestion_runs', 'SELECT')
  and has_table_privilege('service_role', 'public.market_ingestion_runs', 'INSERT')
  and has_table_privilege('service_role', 'public.market_ingestion_runs', 'UPDATE'),
  'service role can operate ingestion runs'
);
select ok(
  has_table_privilege('service_role', 'public.market_indicators', 'INSERT')
  and has_table_privilege('service_role', 'public.market_indicators', 'UPDATE'),
  'service role can persist normalized indicators'
);

select is(
  (select count(*) from public.market_data_sources where id = 'bcb-sgs'),
  1::bigint,
  'official BCB source is registered'
);
select is(
  (select count(*) from public.market_data_sources where id = 'b3-public-eod'),
  1::bigint,
  'official B3 end-of-day source is registered'
);
select is(
  (
    select attribution
    from public.market_data_sources
    where id = 'b3-public-eod'
  ),
  'Fonte: B3 · fechamento oficial D-1',
  'B3 source keeps its required attribution'
);

insert into public.market_indicators (
  source_id, code, source_series, label, value, unit, observed_on
) values (
  'bcb-sgs', 'selic_target', '432', 'Selic', 15, 'percent_year', current_date
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.market_data_sources), 2::bigint, 'authenticated users read provenance');
select is(
  (
    select count(*) from public.market_indicators
    where code = 'selic_target' and observed_on = current_date and value = 15
  ),
  1::bigint,
  'authenticated users read indicators'
);
select is((select count(*) from public.market_instruments), 0::bigint, 'authenticated users read instrument catalog');
select is((select count(*) from public.market_prices), 0::bigint, 'authenticated users read prices');

select throws_ok(
  $$ insert into public.market_indicators (
    source_id, code, source_series, label, value, unit, observed_on
  ) values ('bcb-sgs', 'ipca_monthly', '433', 'IPCA', 1, 'percent_month', current_date) $$,
  '42501',
  null,
  'authenticated users cannot forge indicators'
);
select throws_ok(
  $$ update public.market_indicators set value = 999 $$,
  '42501',
  null,
  'authenticated users cannot alter indicators'
);
select throws_ok(
  $$ delete from public.market_indicators $$,
  '42501',
  null,
  'authenticated users cannot delete indicators'
);
select throws_ok(
  $$ select * from public.market_ingestion_runs $$,
  '42501',
  null,
  'operational runs are not exposed to authenticated users'
);
select throws_ok(
  $$ select * from public.market_data_alerts $$,
  '42501',
  null,
  'operational alerts are not exposed to authenticated users'
);

set local role postgres;
set local role anon;
select throws_ok(
  $$ select * from public.market_indicators $$,
  '42501',
  null,
  'anonymous users cannot read market indicators'
);
select throws_ok(
  $$ select * from public.market_data_sources $$,
  '42501',
  null,
  'anonymous users cannot read source metadata'
);

select * from finish();
rollback;
