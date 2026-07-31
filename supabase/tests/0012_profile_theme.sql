begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(9);

select has_function(
  'public'::name,
  'set_theme_preference'::name,
  array['theme_preference']::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000016',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'nina@example.test', '', now(),
  '{"display_name":"Nina","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000017',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'omar@example.test', '', now(),
  '{"display_name":"Omar","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000016', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ select public.set_theme_preference('dark') $$,
  'owner saves dark preference through boundary'
);
select is(
  (select theme::text from public.profiles),
  'dark',
  'owner reads persisted dark preference'
);
select throws_ok(
  $$ update public.profiles set theme = 'light' $$,
  '42501',
  null,
  'direct theme update is denied'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000017', true);
select is(
  (select theme::text from public.profiles),
  'system',
  'another user starts with independent preference'
);
select lives_ok(
  $$ select public.set_theme_preference('light') $$,
  'another user saves own preference'
);
select is(
  (
    select theme::text from public.profiles
    where id = '00000000-0000-0000-0000-000000000017'
  ),
  'light',
  'another user only changes own preference'
);

set local role postgres;
select is(
  (
    select theme::text from public.profiles
    where id = '00000000-0000-0000-0000-000000000016'
  ),
  'dark',
  'first user preference remains unchanged'
);

set local role anon;
select throws_ok(
  $$ select public.set_theme_preference('dark') $$,
  '42501',
  null,
  'anonymous user cannot change theme'
);

select * from finish();
rollback;
