begin;

create extension if not exists pgtap;
select plan(30);

select has_table('public'::name, 'assistant_threads'::name);
select has_table('public'::name, 'assistant_messages'::name);
select has_table('public'::name, 'ai_generations'::name);
select has_function(
  'public'::name,
  'save_assistant_exchange'::name,
  array[
    'uuid', 'text', 'text', 'jsonb', 'text',
    'text', 'text', 'text', 'jsonb'
  ]::name[]
);
select has_function(
  'public'::name,
  'delete_assistant_thread'::name,
  array['uuid']::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'luiza@example.test', '', now(),
  '{"display_name":"Luiza","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'marcos@example.test', '', now(),
  '{"display_name":"Marcos","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.save_assistant_exchange(
      null,
      'Como está minha carteira?',
      'Como está minha carteira?',
      '{
        "eyebrow":"Carteira",
        "title":"Uma leitura educacional",
        "paragraphs":["A carteira está registrada no North."],
        "facts":[],
        "actions":[{"label":"Ver carteira","href":"/carteira"}],
        "disclaimer":"Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado."
      }'::jsonb,
      'fallback',
      'deterministic-v1',
      'north-educational-2026-07-30',
      repeat('a', 64),
      '["profile:current","portfolio:derived-ledger"]'::jsonb
    )
  $$,
  'owner creates a redacted assistant exchange'
);
select is((select count(*) from public.assistant_threads), 1::bigint, 'owner reads own thread');
select is((select count(*) from public.assistant_messages), 2::bigint, 'exchange stores user and assistant messages');
select is(
  (select count(*) from public.assistant_messages where role = 'assistant'),
  1::bigint,
  'assistant role is explicit'
);
select set_config('test.thread_id', (select id::text from public.assistant_threads limit 1), true);

select lives_ok(
  format(
    $$
      select public.save_assistant_exchange(
        %L::uuid,
        'Meta',
        'Como está minha meta?',
        '{
          "eyebrow":"Meta",
          "title":"Ritmo matemático",
          "paragraphs":["A conta não supõe rentabilidade."],
          "facts":[],
          "actions":[{"label":"Ver metas","href":"/metas"}],
          "disclaimer":"Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado."
        }'::jsonb,
        'fallback',
        'deterministic-v1',
        'north-educational-2026-07-30',
        repeat('b', 64),
        '["goal:active-summary"]'::jsonb
      )
    $$,
    current_setting('test.thread_id')
  ),
  'owner continues own thread'
);
select is((select count(*) from public.assistant_threads), 1::bigint, 'continuation reuses the thread');
select is((select count(*) from public.assistant_messages), 4::bigint, 'continuation appends two messages');
select throws_ok(
  $$
    insert into public.assistant_threads (user_id, title)
    values ('00000000-0000-0000-0000-000000000012', 'Bypass')
  $$,
  '42501',
  null,
  'direct thread inserts are denied'
);
select throws_ok(
  $$
    insert into public.assistant_messages (
      thread_id, user_id, role, content
    ) values (
      current_setting('test.thread_id')::uuid,
      '00000000-0000-0000-0000-000000000012',
      'assistant',
      'Bypass'
    )
  $$,
  '42501',
  null,
  'direct message inserts are denied'
);
select throws_ok(
  $$ update public.assistant_messages set content = 'alterado' $$,
  '42501',
  null,
  'messages are immutable'
);
select throws_ok(
  $$ delete from public.assistant_threads $$,
  '42501',
  null,
  'direct thread deletes are denied'
);
select throws_ok(
  $$ select * from public.ai_generations $$,
  '42501',
  null,
  'technical generation audit is not user-readable'
);
select throws_ok(
  $$
    select public.save_assistant_exchange(
      null,
      'Inválido',
      'Resposta sem disclaimer',
      '{"title":"inválido","paragraphs":["texto"],"facts":[],"actions":[]}'::jsonb,
      'fallback',
      'deterministic-v1',
      'north-educational-2026-07-30',
      repeat('c', 64),
      '[]'::jsonb
    )
  $$,
  '22023',
  'invalid assistant exchange',
  'server disclaimer is mandatory'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', true);
select is((select count(*) from public.assistant_threads), 0::bigint, 'another user cannot read threads');
select is((select count(*) from public.assistant_messages), 0::bigint, 'another user cannot read messages');
select throws_ok(
  format(
    $$ select public.delete_assistant_thread(%L::uuid) $$,
    current_setting('test.thread_id')
  ),
  '42501',
  'thread not available',
  'another user cannot delete the owner thread'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select lives_ok(
  $$
    do $rate$
    declare
      attempt integer;
    begin
      for attempt in 1..18 loop
        perform public.save_assistant_exchange(
          current_setting('test.thread_id')::uuid,
          'Limite',
          'Pergunta educacional',
          '{
            "eyebrow":"Educação",
            "title":"Resposta determinística",
            "paragraphs":["Conteúdo baseado no North."],
            "facts":[],
            "actions":[],
            "disclaimer":"Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado."
          }'::jsonb,
          'fallback',
          'deterministic-v1',
          'north-educational-2026-07-30',
          repeat('d', 64),
          '["profile:current"]'::jsonb
        );
      end loop;
    end
    $rate$
  $$,
  'owner can use the documented hourly allowance'
);
select throws_ok(
  $$
    select public.save_assistant_exchange(
      current_setting('test.thread_id')::uuid,
      'Limite',
      'Pergunta vinte e um',
      '{
        "eyebrow":"Educação",
        "title":"Resposta determinística",
        "paragraphs":["Conteúdo baseado no North."],
        "facts":[],
        "actions":[],
        "disclaimer":"Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado."
      }'::jsonb,
      'fallback',
      'deterministic-v1',
      'north-educational-2026-07-30',
      repeat('e', 64),
      '[]'::jsonb
    )
  $$,
  'P0001',
  'assistant rate limit',
  'twenty-first exchange in one hour is blocked'
);
select lives_ok(
  format(
    $$ select public.delete_assistant_thread(%L::uuid) $$,
    current_setting('test.thread_id')
  ),
  'owner deletes conversation content'
);
select is((select count(*) from public.assistant_threads), 0::bigint, 'thread is deleted');
select is((select count(*) from public.assistant_messages), 0::bigint, 'message content is deleted');

reset role;
select is(
  (select count(*) from public.ai_generations),
  20::bigint,
  'redacted technical audit survives content deletion'
);
select is(
  (select count(*) from public.ai_generations where thread_id is null),
  20::bigint,
  'audit no longer points to deleted content'
);

set local role anon;
select throws_ok(
  $$ select * from public.assistant_threads $$,
  '42501',
  null,
  'anonymous users cannot read threads'
);
select throws_ok(
  $$
    select public.save_assistant_exchange(
      null, 'Sem sessão', 'Sem sessão',
      '{}'::jsonb, 'fallback', 'deterministic-v1',
      'north-educational-2026-07-30', repeat('f', 64), '[]'::jsonb
    )
  $$,
  '42501',
  null,
  'anonymous users cannot save exchanges'
);

select * from finish();
rollback;
