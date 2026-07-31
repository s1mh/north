begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(37);

select has_table('public'::name, 'institutions'::name);
select has_table('public'::name, 'user_institutions'::name);
select has_table('public'::name, 'institution_research_requests'::name);
select has_table('public'::name, 'investment_products'::name);
select has_function('public'::name, 'sync_user_institutions'::name, array['uuid[]']::name[]);
select has_function('public'::name, 'request_institution_research'::name, array['text']::name[]);
select is((select count(*) from public.institutions), 5::bigint, 'curated institutions are seeded');
select is((select count(*) from public.investment_products), 2::bigint, 'only sourced products are seeded');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'lia@example.test', '', now(),
  '{"display_name":"Lia","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'rui@example.test', '', now(),
  '{"display_name":"Rui","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.institutions), 5::bigint, 'authenticated user reads active catalog');
select set_config(
  'test.nubank_id',
  (select id::text from public.institutions where slug = 'nubank'),
  true
);
select set_config(
  'test.itau_id',
  (select id::text from public.institutions where slug = 'itau'),
  true
);
select lives_ok(
  format(
    $$ select public.sync_user_institutions(array[%L::uuid, %L::uuid]) $$,
    current_setting('test.nubank_id'),
    current_setting('test.itau_id')
  ),
  'owner syncs curated institutions'
);
select is((select count(*) from public.user_institutions), 2::bigint, 'owner reads two links');
select throws_ok(
  format(
    $$ insert into public.user_institutions (user_id, institution_id)
       values ('00000000-0000-0000-0000-000000000014', %L::uuid) $$,
    current_setting('test.nubank_id')
  ),
  '42501',
  null,
  'direct institution links are denied'
);
select throws_ok(
  $$ select public.sync_user_institutions('{}'::uuid[]) $$,
  '22023',
  'invalid institutions',
  'empty selection is denied'
);
select throws_ok(
  format(
    $$ select public.sync_user_institutions(array[%L::uuid, %L::uuid]) $$,
    current_setting('test.nubank_id'),
    current_setting('test.nubank_id')
  ),
  '22023',
  'invalid institutions',
  'duplicate selection is denied'
);
select throws_ok(
  $$ select public.sync_user_institutions(
    array['00000000-0000-4000-8000-000000009999'::uuid]
  ) $$,
  '22023',
  'invalid institutions',
  'unknown institution is denied'
);

select lives_ok(
  $$ select public.request_institution_research('  Banco   Horizonte  ') $$,
  'plain custom institution enters review queue'
);
select is((select count(*) from public.institution_research_requests), 1::bigint, 'owner reads own request');
select is(
  (select normalized_name from public.institution_research_requests limit 1),
  'banco horizonte',
  'request name is normalized'
);
select lives_ok(
  $$ select public.request_institution_research('Banco Horizonte') $$,
  'same request is idempotent'
);
select is((select count(*) from public.institution_research_requests), 1::bigint, 'duplicate request is not duplicated');
select throws_ok(
  $$ select public.request_institution_research('https://banco.example') $$,
  '22023',
  'invalid institution request',
  'URL input is never accepted for collection'
);
select throws_ok(
  $$ select public.request_institution_research('<Banco>') $$,
  '22023',
  'invalid institution request',
  'markup input is denied'
);
select throws_ok(
  $$ select public.request_institution_research('Nubank') $$,
  '23505',
  'institution already available',
  'available institution does not enter queue'
);
select lives_ok($$ select public.request_institution_research('Banco Um') $$, 'second request is accepted');
select lives_ok($$ select public.request_institution_research('Banco Dois') $$, 'third request is accepted');
select lives_ok($$ select public.request_institution_research('Banco Três') $$, 'fourth request is accepted');
select lives_ok($$ select public.request_institution_research('Banco Quatro') $$, 'fifth request is accepted');
select throws_ok(
  $$ select public.request_institution_research('Banco Cinco') $$,
  'P0001',
  'institution request limit',
  'daily request limit is enforced'
);
select throws_ok(
  $$ insert into public.institution_research_requests (
    user_id, requested_name, normalized_name
  ) values (
    '00000000-0000-0000-0000-000000000014', 'Direto', 'direto'
  ) $$,
  '42501',
  null,
  'direct research queue writes are denied'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000015', true);
select is((select count(*) from public.user_institutions), 0::bigint, 'another user cannot read links');
select is((select count(*) from public.institution_research_requests), 0::bigint, 'another user cannot read requests');
select lives_ok(
  $$ select public.request_institution_research('Banco Horizonte') $$,
  'different user can request same institution'
);

set local role postgres;
select throws_ok(
  format(
    $$
      insert into public.investment_products (
        institution_id, slug, name, asset_class, summary, return_description,
        liquidity, maturity, protection, educational_comparison, source_url,
        source_label, verified_at, review_due_at
      ) values (
        %L::uuid, 'fonte-invalida', 'Fonte inválida', 'renda_fixa',
        'Produto usado somente para validar a origem.',
        'Taxa não informada', 'Não informada', 'Não informado',
        'Sem informação', 'Comparação educacional usada somente no teste da allowlist.',
        'https://evil.example/produto', 'Fonte inválida',
        '2026-07-30', '2026-08-30'
      )
    $$,
    current_setting('test.nubank_id')
  ),
  '22023',
  'source host not allowed',
  'product source must belong to institution allowlist'
);

set local role anon;
select throws_ok($$ select * from public.institutions $$, '42501', null, 'anonymous cannot read institutions');
select throws_ok($$ select * from public.investment_products $$, '42501', null, 'anonymous cannot read products');
select throws_ok(
  $$ select public.sync_user_institutions(
    array['00000000-0000-4000-8000-000000009999'::uuid]
  ) $$,
  '42501',
  null,
  'anonymous cannot sync institutions'
);
select throws_ok(
  $$ select public.request_institution_research('Banco Anônimo') $$,
  '42501',
  null,
  'anonymous cannot request research'
);

select * from finish();
rollback;
