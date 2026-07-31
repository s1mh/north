begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(13);

select has_function(
  'public'::name,
  'export_current_user_data'::name,
  array[]::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000018',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'paula@example.test', '', now(),
  '{"display_name":"Paula","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000019',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'rui@example.test', '', now(),
  '{"display_name":"Rui","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

insert into public.portfolio_institutions (id, user_id, name) values
(
  '10000000-0000-0000-0000-000000000018',
  '00000000-0000-0000-0000-000000000018',
  'Corretora Paula'
);
insert into public.portfolio_instruments (
  id, user_id, institution_id, symbol, name, asset_class
) values (
  '20000000-0000-0000-0000-000000000018',
  '00000000-0000-0000-0000-000000000018',
  '10000000-0000-0000-0000-000000000018',
  'PWA3',
  'Ativo da Paula',
  'acoes'
);
insert into public.portfolio_transactions (
  user_id, instrument_id, transaction_type, trade_date, quantity, unit_price
) values (
  '00000000-0000-0000-0000-000000000018',
  '20000000-0000-0000-0000-000000000018',
  'compra',
  '2026-07-30',
  2,
  10
);
insert into public.goals (
  user_id, name, kind, target_amount, target_date
) values (
  '00000000-0000-0000-0000-000000000018',
  'Meta da Paula',
  'reserva',
  1000,
  '2027-07-30'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000018', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.export_current_user_data() ->> 'schema_version',
  '2026-07-31',
  'export identifies its schema version'
);
select is(
  public.export_current_user_data() #>> '{account,email}',
  'paula@example.test',
  'export contains the current account identity'
);
select is(
  jsonb_array_length(public.export_current_user_data() #> '{data,portfolio_transactions}'),
  1,
  'export includes the owner portfolio history'
);
select is(
  public.export_current_user_data() #>> '{data,goals,0,name}',
  'Meta da Paula',
  'export includes the owner goals'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000019', true);
select is(
  public.export_current_user_data() #>> '{account,email}',
  'rui@example.test',
  'another user receives an independent export'
);
select is(
  jsonb_array_length(public.export_current_user_data() #> '{data,portfolio_transactions}'),
  0,
  'another user cannot export the first portfolio'
);

set local role anon;
select throws_ok(
  $$ select public.export_current_user_data() $$,
  '42501',
  null,
  'anonymous export is denied'
);
select throws_ok(
  $$ select count(*) from public.account_security_events $$,
  '42501',
  null,
  'anonymous users cannot read operational deletion events'
);

set local role postgres;
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-000000000018' $$,
  'account deletion cascades through the portfolio chain'
);
select is(
  (
    select
      (select count(*) from public.portfolio_institutions where user_id = '00000000-0000-0000-0000-000000000018')
      + (select count(*) from public.portfolio_instruments where user_id = '00000000-0000-0000-0000-000000000018')
      + (select count(*) from public.portfolio_transactions where user_id = '00000000-0000-0000-0000-000000000018')
      + (select count(*) from public.goals where user_id = '00000000-0000-0000-0000-000000000018')
  ),
  0::bigint,
  'personal records are removed with the account'
);
select is(
  (select count(*) from public.account_security_events),
  1::bigint,
  'completed deletion creates an anonymous operational event'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000019'),
  1::bigint,
  'another account remains intact'
);

select * from finish();
rollback;
