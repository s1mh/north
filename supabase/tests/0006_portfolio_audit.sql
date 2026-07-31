begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(17);

select has_function(
  'public'::name,
  'reverse_portfolio_transaction'::name,
  array['uuid', 'text']::name[]
);
select has_function(
  'public'::name,
  'correct_portfolio_transaction'::name,
  array['uuid', 'portfolio_transaction_type', 'numeric', 'numeric', 'numeric', 'numeric', 'date', 'text']::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
)
values
(
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'iris@example.test', '', now(),
  '{"display_name":"Iris","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'joao@example.test', '', now(),
  '{"display_name":"Joao","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ select public.create_portfolio_asset('Corretora', 'AUDT3', 'Ativo auditável', 'acoes', 10, 20, 0, '2026-07-20') $$,
  'owner creates an auditable position'
);
select lives_ok(
  $$
    select public.record_portfolio_transaction(
      (select id from public.portfolio_instruments limit 1),
      'venda', 4, 25, 0, 0, '2026-07-21'
    )
  $$,
  'owner records a sale'
);

select throws_ok(
  $$
    select public.reverse_portfolio_transaction(
      (select id from public.portfolio_transactions where transaction_type = 'compra' limit 1),
      'Compra duplicada'
    )
  $$,
  '22003',
  'dependent transactions',
  'purchase cannot be reversed while a later sale depends on it'
);

select lives_ok(
  $$
    select public.correct_portfolio_transaction(
      (select id from public.portfolio_transactions where transaction_type = 'venda' limit 1),
      'venda', 5, 27, 1, 0, '2026-07-21', 'Quantidade vendida incorreta'
    )
  $$,
  'sale is corrected without changing the original'
);
select is((select count(*) from public.portfolio_transactions), 4::bigint, 'correction adds reversal and replacement');
select is(
  (select count(*) from public.portfolio_transactions where reverses_transaction_id is not null),
  1::bigint,
  'audit history identifies the reversal'
);
select is(
  (select count(*) from public.portfolio_transactions where corrects_transaction_id is not null),
  1::bigint,
  'audit history identifies the replacement'
);
select is(
  (
    select sum(case
      when transaction_type in ('compra', 'aporte') then quantity
      when transaction_type in ('venda', 'resgate') then -quantity
      else 0
    end)
    from public.portfolio_transactions transaction
    where reverses_transaction_id is null
      and not exists (
        select 1 from public.portfolio_transactions reversal
        where reversal.reverses_transaction_id = transaction.id
      )
  ),
  5::numeric,
  'effective position uses only the corrected sale'
);
select is(
  (select latest_price from public.portfolio_instruments),
  27::numeric,
  'manual price follows the latest effective transaction'
);

select throws_ok(
  $$
    select public.correct_portfolio_transaction(
      (select reverses_transaction_id from public.portfolio_transactions where reverses_transaction_id is not null),
      'venda', 3, 28, 0, 0, '2026-07-21', 'Outra correção'
    )
  $$,
  '42501',
  'transaction not available',
  'an already corrected original cannot be corrected twice'
);

select lives_ok(
  $$
    select public.reverse_portfolio_transaction(
      (select id from public.portfolio_transactions where corrects_transaction_id is not null),
      'Venda lançada por engano'
    )
  $$,
  'corrected sale can be reversed'
);
select is(
  (select latest_price from public.portfolio_instruments),
  20::numeric,
  'price returns to the latest effective purchase'
);
select is(
  (select audit_reason from public.portfolio_transactions where corrects_transaction_id is not null),
  'Quantidade vendida incorreta',
  'correction reason is preserved'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000010', true);
select is((select count(*) from public.portfolio_transactions), 0::bigint, 'another user cannot read audit records');
select throws_ok(
  $$
    select public.reverse_portfolio_transaction(
      '00000000-0000-0000-0000-000000000001',
      'Tentativa indevida'
    )
  $$,
  '42501',
  'transaction not available',
  'another user cannot reverse an owner transaction'
);

select * from finish();
rollback;
