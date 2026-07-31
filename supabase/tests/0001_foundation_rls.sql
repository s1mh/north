begin;
set local role postgres;
set local search_path = public, extensions;
select plan(13);

select has_table('public'::name, 'profiles'::name);
select has_table('public'::name, 'consent_records'::name);
select has_table('public'::name, 'suitability_assessments'::name);
select has_table('public'::name, 'goals'::name);
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.goals'::regclass), true, 'goals has RLS');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ana@example.test',
    '',
    now(),
    '{"display_name":"Ana","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bia@example.test',
    '',
    now(),
    '{"display_name":"Bia","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
    now(),
    now()
  );
insert into public.goals (user_id, name, kind, target_amount, target_date) values
  ('00000000-0000-0000-0000-000000000001', 'Reserva da Ana', 'reserva', 30000, '2027-12-31');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.profiles), 1::bigint, 'Bia reads only her profile');
select is((select count(*) from public.goals), 0::bigint, 'Bia cannot read Ana goals');
select throws_ok($$ insert into public.goals (user_id,name,kind,target_amount,target_date) values ('00000000-0000-0000-0000-000000000001','Ataque','reserva',1,'2028-01-01') $$, '42501', null, 'Bia cannot insert for Ana');
select lives_ok($$ update public.goals set name = 'Ataque' where user_id = '00000000-0000-0000-0000-000000000001' $$, 'cross-owner update exposes no row');
select lives_ok($$ delete from public.goals where user_id = '00000000-0000-0000-0000-000000000001' $$, 'cross-owner delete exposes no row');
select is((select count(*) from public.goals), 0::bigint, 'Ana goal remains invisible');

set local role postgres;
select is((select count(*) from public.goals where name = 'Reserva da Ana'), 1::bigint, 'Ana goal was not changed or deleted');
select * from finish();
rollback;
