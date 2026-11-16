begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'email2fa@example.test', '', now(),
  '{"display_name":"Email Fator","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb,
  now(), now()
);

-- Habilita pelo fluxo "enable": emite o código e confere (como a rota do servidor faz com a chave de serviço).
select isnt(public.email_2fa_issue('00000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', 'enable', '123456'), null::uuid, 'emite um desafio');
select is(public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', 'enable', '000000'), false, 'código errado é recusado');
select is(public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', 'enable', '123456'), true, 'código certo ativa o fator');

-- Sessão nova (outra session_id) com a senha apenas: bloqueada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1","session_id":"b0000000-0000-0000-0000-000000000002"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true);
select is((select count(*) from public.profiles), 0::bigint, 'sessão sem código: perfil não é visível');
select throws_ok($$ select public.set_theme_preference('dark') $$, '42501', 'mfa_required', 'sessão sem código: escrita é recusada');
select is((public.second_factor_status() ->> 'method'), 'email', 'status informa o método');
select is((public.second_factor_status() ->> 'satisfied'), 'false', 'status informa que falta o código');

-- A sessão que confirmou o código passa
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1","session_id":"a0000000-0000-0000-0000-000000000001"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'sessão verificada: perfil visível');
select lives_ok($$ select public.set_theme_preference('dark') $$, 'sessão verificada: escrita funciona');

-- Desligar exige sessão verificada e remove a exigência
select lives_ok($$ select public.disable_email_2fa() $$, 'sessão verificada pode desligar');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1","session_id":"b0000000-0000-0000-0000-000000000002"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'depois de desligar, qualquer sessão acessa');

-- Limite de tentativas e de envios (como postgres, que simula o servidor)
set local role postgres;
select public.email_2fa_issue('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '654321');
select public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '1');
select public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '2');
select public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '3');
select public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '4');
select public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '5');
select throws_ok($$ select public.email_2fa_check('00000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000003', 'login', '654321') $$, '54000', 'too_many_attempts', 'depois de 5 erros o desafio é bloqueado');

select * from finish();
rollback;
