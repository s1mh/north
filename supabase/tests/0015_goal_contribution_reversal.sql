begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(8);

select has_column('public', 'goal_contributions', 'reversed_at', 'reversal timestamp is stored');
select has_column('public', 'goal_contributions', 'reversal_reason', 'reversal reason is stored');
select has_function('public', 'reverse_goal_contribution', array['uuid', 'text']);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'reversal-owner@example.test', '', now(),
  '{"display_name":"Lia","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000016',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'reversal-other@example.test', '', now(),
  '{"display_name":"Rui","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000015', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_goal_with_plan('Reserva', 'reserva', 10000, current_date + 365, 500);
select public.record_goal_contribution(
  (select id from public.goals limit 1), 750, current_date, 'Aporte de teste'
);

select lives_ok(
  $$ select public.reverse_goal_contribution(
    (select id from public.goal_contributions limit 1), 'Lançamento duplicado'
  ) $$,
  'owner reverses a contribution with an audit reason'
);
select is((select count(*) from public.goal_contributions), 1::bigint, 'reversal preserves the ledger row');
select is((select count(*) from public.goal_contributions where reversed_at is not null), 1::bigint, 'reversal marks the row');
select throws_ok(
  $$ select public.reverse_goal_contribution(
    (select id from public.goal_contributions limit 1), 'Outra tentativa'
  ) $$,
  '42501', 'contribution not available', 'a contribution cannot be reversed twice'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000016', true);
select throws_ok(
  $$ select public.reverse_goal_contribution(
    (select id from public.goal_contributions limit 1), 'Tentativa de terceiro'
  ) $$,
  '42501', 'contribution not available', 'another user cannot reverse the contribution'
);

select * from finish();
rollback;
