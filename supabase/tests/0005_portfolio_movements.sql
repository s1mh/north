begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
)
values
(
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gina@example.test', '', now(),
  '{"display_name":"Gina","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'heitor@example.test', '', now(),
  '{"display_name":"Heitor","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ select public.create_portfolio_asset('Corretora', 'TEST3', 'Ativo teste', 'acoes', 10, 20, 0, '2026-07-20') $$,
  'owner creates the initial position'
);

select lives_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'compra', 2, 22, 1, 0, '2026-07-21'
    )
  $$,
  'additional purchase is recorded'
);
select lives_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'rendimento', 0, 0, 0, 15.50, '2026-07-22'
    )
  $$,
  'income is recorded'
);
select lives_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'taxa', 0, 0, 0, 2.25, '2026-07-23'
    )
  $$,
  'standalone fee is recorded'
);
select lives_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'venda', 4, 25, 1, 0, '2026-07-24'
    )
  $$,
  'sale is recorded'
);
select is((select count(*) from public.portfolio_transactions), 5::bigint, 'complete history is preserved');
select is(
  (
    select sum(case
      when transaction_type in ('compra', 'aporte') then quantity
      when transaction_type in ('venda', 'resgate') then -quantity
      else 0
    end)
    from public.portfolio_transactions
  ),
  8::numeric,
  'position reflects purchases and sale'
);
select is(
  (select cash_amount from public.portfolio_transactions where transaction_type = 'rendimento'),
  15.50::numeric,
  'income keeps its exact monetary value'
);

select throws_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'venda', 1, 25, 0, 0, '2026-07-19'
    )
  $$,
  '22003',
  'insufficient position',
  'backdated sale cannot make the historical position negative'
);
select throws_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'rendimento', 1, 0, 0, 10, '2026-07-24'
    )
  $$,
  '22023',
  'invalid transaction',
  'income cannot change quantity'
);
select throws_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'venda', 1, 25, 0, 10, '2026-07-24'
    )
  $$,
  '22023',
  'invalid transaction',
  'sale cannot also carry a cash amount'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000008', true);
select is((select count(*) from public.portfolio_transactions), 0::bigint, 'another user cannot read the history');
select throws_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'rendimento', 0, 0, 0, 10, '2026-07-24'
    )
  $$,
  '42501',
  'instrument not available',
  'another user cannot add a movement'
);

select * from finish();
rollback;
