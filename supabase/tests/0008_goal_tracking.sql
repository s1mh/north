begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(23);

select has_table('public'::name, 'goal_contributions'::name);
select has_table('public'::name, 'contribution_plans'::name);
select has_function(
  'public'::name,
  'create_goal_with_plan'::name,
  array['text', 'text', 'numeric', 'date', 'numeric']::name[]
);
select has_function(
  'public'::name,
  'record_goal_contribution'::name,
  array['uuid', 'numeric', 'date', 'text']::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gabi@example.test', '', now(),
  '{"display_name":"Gabi","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'heitor@example.test', '', now(),
  '{"display_name":"Heitor","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.create_goal_with_plan(
      'Viagem', 'viagem', 25000,
      ((now() at time zone 'America/Sao_Paulo')::date + interval '18 months')::date,
      530
    )
  $$,
  'owner creates a goal and monthly plan atomically'
);
select throws_ok(
  $$
    insert into public.goals (
      user_id, name, kind, target_amount, target_date
    ) values (
      '00000000-0000-0000-0000-000000000008',
      'Atalho sem validação',
      'viagem',
      1000,
      current_date + 30
    )
  $$,
  '42501',
  null,
  'goal creation cannot bypass the validated function'
);
select is((select count(*) from public.goals), 1::bigint, 'owner sees the goal');
select is((select count(*) from public.contribution_plans), 1::bigint, 'owner sees the plan');
select is(
  (select amount from public.contribution_plans limit 1),
  530.00::numeric,
  'monthly plan preserves numeric money'
);

select lives_ok(
  $$
    select public.record_goal_contribution(
      (select id from public.goals limit 1),
      9200,
      (now() at time zone 'America/Sao_Paulo')::date,
      'Saldo já reservado'
    )
  $$,
  'owner records a manual contribution'
);
select is(
  (select sum(amount) from public.goal_contributions),
  9200.00::numeric,
  'progress source is the contribution ledger'
);
select throws_ok(
  $$
    insert into public.goal_contributions (
      user_id, goal_id, amount, contributed_on
    ) values (
      '00000000-0000-0000-0000-000000000008',
      (select id from public.goals limit 1),
      1,
      current_date
    )
  $$,
  '42501',
  null,
  'direct contribution inserts are denied'
);
select throws_ok(
  $$
    update public.goal_contributions set amount = 1
  $$,
  '42501',
  null,
  'contribution ledger cannot be edited directly'
);
select throws_ok(
  $$
    delete from public.goal_contributions
  $$,
  '42501',
  null,
  'contribution ledger cannot be deleted directly'
);
select throws_ok(
  $$
    select public.create_goal_with_plan(
      'Ontem', 'viagem', 1000,
      ((now() at time zone 'America/Sao_Paulo')::date - 1),
      100
    )
  $$,
  '22023',
  'invalid goal',
  'goal deadline must be in the future'
);
select throws_ok(
  $$
    select public.record_goal_contribution(
      (select id from public.goals limit 1),
      -1,
      (now() at time zone 'America/Sao_Paulo')::date,
      null
    )
  $$,
  '22023',
  'invalid contribution',
  'contribution must be positive'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', true);
select is((select count(*) from public.goals), 0::bigint, 'another user cannot read goals');
select is((select count(*) from public.contribution_plans), 0::bigint, 'another user cannot read plans');
select is((select count(*) from public.goal_contributions), 0::bigint, 'another user cannot read contributions');
select throws_ok(
  $$
    select public.record_goal_contribution(
      (select id from public.goals limit 1),
      100,
      (now() at time zone 'America/Sao_Paulo')::date,
      null
    )
  $$,
  '42501',
  'goal not available',
  'another user cannot contribute to the owner goal'
);

set local role postgres;
set local role anon;
select throws_ok(
  $$ select * from public.goal_contributions $$,
  '42501',
  null,
  'anonymous users cannot read contributions'
);
select throws_ok(
  $$ select * from public.contribution_plans $$,
  '42501',
  null,
  'anonymous users cannot read plans'
);
select throws_ok(
  $$
    select public.create_goal_with_plan(
      'Sem sessão', 'viagem', 1000, current_date + 30, 100
    )
  $$,
  '42501',
  null,
  'anonymous users cannot execute goal creation'
);

select * from finish();
rollback;
