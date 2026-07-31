begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;

select plan(5);

select has_function('public'::name, 'handle_new_user'::name);
select has_trigger('auth'::name, 'users'::name, 'on_auth_user_created'::name);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'carla@example.test',
  '',
  now(),
  '{
    "display_name": "Carla",
    "consent_terms_version": "2026-07-28",
    "consent_privacy_version": "2026-07-28"
  }'::jsonb,
  now(),
  now()
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'Carla',
  'signup creates the profile'
);
select is(
  (select onboarding::text from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'suitability',
  'signup advances onboarding'
);
select is(
  (select count(*) from public.consent_records where user_id = '00000000-0000-0000-0000-000000000003'),
  2::bigint,
  'signup records both consent documents'
);

select * from finish();
rollback;
