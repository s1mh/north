begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mfa-com@example.test', '', now(),
  '{"display_name":"Com Fator","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mfa-sem@example.test', '', now(),
  '{"display_name":"Sem Fator","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb,
  now(), now()
);

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000031', 'App', 'totp', 'verified', now(), now(), 'x');

-- Usuário COM fator, sessão aal1 (só senha)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.profiles), 0::bigint, 'aal1 com fator: perfil não é visível');
select throws_ok($$ select public.set_theme_preference('dark') $$, '42501', 'mfa_required', 'aal1 com fator: função de escrita é recusada');
select throws_ok($$ select public.export_current_user_data() $$, '42501', 'mfa_required', 'aal1 com fator: exportação é recusada');
select throws_ok($$ select public.generate_mfa_recovery_codes() $$, '42501', 'mfa_required', 'aal1 com fator: não gera códigos de recuperação');

-- Mesmo usuário, sessão aal2 (senha + código)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal2"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'aal2: perfil visível');
select lives_ok($$ select public.set_theme_preference('dark') $$, 'aal2: função de escrita funciona');
select is(array_length(public.generate_mfa_recovery_codes(), 1), 8, 'aal2: gera 8 códigos de recuperação');

-- Usuário SEM fator continua normal em aal1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000032","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);
select is((select count(*) from public.profiles), 1::bigint, 'sem fator: perfil visível em aal1');
select lives_ok($$ select public.set_theme_preference('light') $$, 'sem fator: função de escrita funciona em aal1');
select throws_ok($$ select public.generate_mfa_recovery_codes() $$, '22023', 'mfa_not_enabled', 'sem fator: não gera códigos');

-- Recuperação: usuário COM fator em aal1 usa um código
set local role postgres;
insert into public.mfa_recovery_codes (user_id, code_hash)
values ('00000000-0000-0000-0000-000000000031', encode(extensions.digest('ABCDE-12345', 'sha256'), 'hex'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select is(public.consume_mfa_recovery_code('abcde-12345'), true, 'código válido é aceito (sem diferenciar maiúsculas)');
select is(public.consume_mfa_recovery_code('ABCDE-12345'), false, 'o mesmo código não vale duas vezes');

-- Limite de tentativas: 5 erradas e a sexta é bloqueada (a de cima já contou 1)
select public.consume_mfa_recovery_code('00000-00001');
select public.consume_mfa_recovery_code('00000-00002');
select public.consume_mfa_recovery_code('00000-00003');
select public.consume_mfa_recovery_code('00000-00004');
select throws_ok($$ select public.consume_mfa_recovery_code('00000-00005') $$, '54000', 'too_many_attempts', 'muitas tentativas bloqueiam');

select * from finish();
rollback;
