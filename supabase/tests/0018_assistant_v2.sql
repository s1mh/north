begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asst-a@example.test', '', now(),
 '{"display_name":"Ana","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb, now(), now()),
('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asst-b@example.test', '', now(),
 '{"display_name":"Beto","consent_terms_version":"2026-11-16","consent_privacy_version":"2026-11-16"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- turno completo: reserva, proposta, gravação
select lives_ok($$ select public.claim_assistant_turn(40) $$, 'reserva uma mensagem');
create temp table t_gen as select public.claim_assistant_turn(30) as id;
create temp table t_act as select public.create_assistant_action('record_transaction', '{"x":1}'::jsonb) as id;
create temp table t_turn as
  select public.save_assistant_turn(
    (select id from t_gen), null, 'Aporte nas caixinhas', 'Coloquei 500 nas caixinhas',
    'Confira os dados e confirme.', '{"v":2,"text":"ok"}'::jsonb,
    'generated', 'openai/gpt-5.6-luna', array[(select id from t_act)]
  ) as r;
grant all on t_gen, t_act, t_turn to authenticated;

select is((select count(*) from public.assistant_messages), 2::bigint, 'grava pergunta e resposta');
select is((select count(*) from public.assistant_threads), 1::bigint, 'cria a conversa');
select is(
  (select message_id from public.assistant_actions where id = (select id from t_act)),
  ((select r->>'assistant_message_id' from t_turn))::uuid,
  'a ação fica ligada à mensagem do assistente'
);
select throws_ok(
  $$ select public.save_assistant_turn((select id from t_gen), null, 'Outra', 'Outra pergunta', 'Resposta', '{}'::jsonb, 'generated', 'openai/gpt-5.6-luna', null) $$,
  '42501', 'generation claim not available', 'a mesma reserva não vale duas vezes'
);

-- máquina de estados
select lives_ok($$ select public.transition_assistant_action((select id from t_act), 'proposed', 'confirming') $$, 'proposta -> confirmando');
select throws_ok($$ select public.transition_assistant_action((select id from t_act), 'proposed', 'confirming') $$, '42501', 'action not available', 'não confirma duas vezes');
select throws_ok($$ select public.transition_assistant_action((select id from t_act), 'confirming', 'undone') $$, '22023', 'invalid transition', 'salto de estado é recusado');
select is(public.transition_assistant_action((select id from t_act), 'confirming', 'confirmed', '{"transaction_id":"abc"}'::jsonb)->>'status', 'confirmed', 'confirmando -> confirmada, com resultado');
select is((select result->>'transaction_id' from public.assistant_actions where id = (select id from t_act)), 'abc', 'resultado guardado');

-- proposta vencida
set local role postgres;
update public.assistant_actions set status = 'proposed', expires_at = now() - interval '1 minute' where id = (select id from t_act);
set local role authenticated;
select throws_ok($$ select public.transition_assistant_action((select id from t_act), 'proposed', 'confirming') $$, '42501', 'action not available', 'proposta vencida não confirma');
select lives_ok($$ select public.transition_assistant_action((select id from t_act), 'proposed', 'cancelled') $$, 'proposta vencida ainda pode ser cancelada');

-- isolamento entre pessoas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000042","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000042', true);
select is((select count(*) from public.assistant_actions), 0::bigint, 'outra pessoa não vê as ações');
select throws_ok($$ select public.transition_assistant_action((select id from t_act), 'cancelled', 'confirming') $$, '22023', 'invalid transition', 'transição inválida mesmo para outra pessoa');
select throws_ok(
  $$ select public.save_assistant_turn((select id from t_gen), (select (r->>'thread_id')::uuid from t_turn), 'X1', 'Pergunta', 'Resposta', '{}'::jsonb, 'generated', 'openai/gpt-5.6-luna', null) $$,
  '42501', null, 'não grava em conversa de outra pessoa'
);

-- limite de uso
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true);
do $$ begin for i in 1..18 loop perform public.claim_assistant_turn(10); end loop; end $$;
select throws_ok($$ select public.claim_assistant_turn(10) $$, 'P0001', 'assistant rate limit', 'limite de 20 mensagens por hora');

select * from finish();
rollback;
