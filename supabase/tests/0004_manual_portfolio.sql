begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(16);

select has_table('public'::name, 'portfolio_instruments'::name);
select has_table('public'::name, 'portfolio_transactions'::name);
select has_function(
  'public'::name,
  'create_portfolio_asset'::name,
  array['text', 'text', 'text', 'asset_class', 'numeric', 'numeric', 'numeric', 'date']::name[]
);
select has_function(
  'public'::name,
  'record_portfolio_transaction'::name,
  array['uuid', 'portfolio_transaction_type', 'numeric', 'numeric', 'numeric', 'numeric', 'date']::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
)
values
(
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'eva@example.test', '', now(),
  '{"display_name":"Eva","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'fabio@example.test', '', now(),
  '{"display_name":"Fabio","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ select public.create_portfolio_asset('Nubank', 'petr4', 'Petrobras PN', 'acoes', 10, 30.125, 1.25, (now() at time zone 'America/Sao_Paulo')::date) $$,
  'owner creates an asset with its initial purchase'
);
select is((select count(*) from public.portfolio_institutions), 1::bigint, 'institution is visible to owner');
select is((select count(*) from public.portfolio_instruments), 1::bigint, 'instrument is visible to owner');
select is((select count(*) from public.portfolio_transactions), 1::bigint, 'initial purchase is visible to owner');

select lives_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'venda', 4, 35, 0, 0, (now() at time zone 'America/Sao_Paulo')::date
    )
  $$,
  'partial sale is accepted'
);
select is(
  (
    select sum(case when transaction_type = 'compra' then quantity else -quantity end)
    from public.portfolio_transactions
  ),
  6::numeric,
  'partial sale leaves the correct quantity'
);
select throws_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'venda', 7, 35, 0, 0, (now() at time zone 'America/Sao_Paulo')::date
    )
  $$,
  '22003',
  'insufficient position',
  'sale cannot make the position negative'
);
select throws_ok(
  $$
    update public.portfolio_transactions set quantity = 99
  $$,
  '42501',
  null,
  'ledger entries cannot be edited directly'
);
select throws_ok(
  $$
    delete from public.portfolio_transactions
  $$,
  '42501',
  null,
  'ledger entries cannot be deleted directly'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);
select is((select count(*) from public.portfolio_instruments), 0::bigint, 'another user cannot see instruments');
select is((select count(*) from public.portfolio_transactions), 0::bigint, 'another user cannot see transactions');
select throws_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'compra', 1, 35, 0, 0, (now() at time zone 'America/Sao_Paulo')::date
    )
  $$,
  '42501',
  'instrument not available',
  'another user cannot write to the owner instrument'
);

select * from finish();
rollback;
