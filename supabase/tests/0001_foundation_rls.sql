begin;
select plan(13);

select has_table('public', 'profiles');
select has_table('public', 'consent_records');
select has_table('public', 'suitability_assessments');
select has_table('public', 'goals');
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.goals'::regclass), true, 'goals has RLS');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bia@example.test', '', now(), now(), now());

insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'Ana'),
  ('00000000-0000-0000-0000-000000000002', 'Bia');
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

reset role;
select is((select count(*) from public.goals where name = 'Reserva da Ana'), 1::bigint, 'Ana goal was not changed or deleted');
select * from finish();
rollback;
