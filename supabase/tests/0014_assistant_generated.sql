begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(14);

select has_function(
  'public'::name,
  'claim_assistant_generation'::name,
  array['text', 'text', 'jsonb', 'integer']::name[]
);
select has_function(
  'public'::name,
  'save_claimed_assistant_exchange'::name,
  array[
    'uuid', 'uuid', 'text', 'text', 'jsonb',
    'text', 'text', 'text', 'text', 'jsonb'
  ]::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'bia@example.test', '', now(),
  '{"display_name":"Bia","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role anon;
select throws_ok(
  $$
    select public.claim_assistant_generation(
      'north-educational-2026-07-30', repeat('a', 64), '[]'::jsonb, 20
    )
  $$,
  '42501',
  null,
  'anonymous users cannot reserve paid generations'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select set_config(
      'test.generation_id',
      public.claim_assistant_generation(
        'north-educational-2026-07-30',
        repeat('b', 64),
        '["profile:current"]'::jsonb,
        25
      )::text,
      true
    )
  $$,
  'authenticated user reserves an interaction before provider work'
);

set local role postgres;
select is(
  (select count(*) from public.ai_generations where status = 'pending'),
  1::bigint,
  'reservation is persisted as pending'
);

set local role authenticated;
select lives_ok(
  format(
    $$
      select public.save_claimed_assistant_exchange(
        %L::uuid,
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
        'generated',
        'openai/gpt-5.6-luna',
        'north-educational-2026-07-30',
        repeat('b', 64),
        '["profile:current"]'::jsonb
      )
    $$,
    current_setting('test.generation_id')
  ),
  'generated response finalizes the matching reservation'
);
select is((select count(*) from public.assistant_threads), 1::bigint, 'generated exchange creates a thread');
select is((select count(*) from public.assistant_messages), 2::bigint, 'generated exchange stores both messages');

set local role postgres;
select is(
  (
    select status || ':' || model
    from public.ai_generations
    where id = current_setting('test.generation_id')::uuid
  ),
  'generated:openai/gpt-5.6-luna',
  'audit records the resolved paid model'
);

set local role authenticated;
select throws_ok(
  format(
    $$
      select public.save_claimed_assistant_exchange(
        %L::uuid, null, 'Reuso', 'Pergunta repetida',
        '{
          "eyebrow":"Carteira",
          "title":"Resposta",
          "paragraphs":["Conteúdo validado."],
          "facts":[],
          "actions":[],
          "disclaimer":"Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado."
        }'::jsonb,
        'generated', 'openai/gpt-5.6-luna',
        'north-educational-2026-07-30', repeat('b', 64),
        '["profile:current"]'::jsonb
      )
    $$,
    current_setting('test.generation_id')
  ),
  '42501',
  'generation claim not available',
  'a reservation cannot be reused'
);

select set_config(
  'test.invalid_generation_id',
  public.claim_assistant_generation(
    'north-educational-2026-07-30', repeat('c', 64), '[]'::jsonb, 20
  )::text,
  true
);
select throws_ok(
  format(
    $$
      select public.save_claimed_assistant_exchange(
        %L::uuid, null, 'Modelo inválido', 'Modelo inválido',
        '{
          "eyebrow":"Modelo",
          "title":"Resposta",
          "paragraphs":["Conteúdo validado."],
          "facts":[],
          "actions":[],
          "disclaimer":"Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado."
        }'::jsonb,
        'generated', 'modelo-invalido',
        'north-educational-2026-07-30', repeat('c', 64), '[]'::jsonb
      )
    $$,
    current_setting('test.invalid_generation_id')
  ),
  '22023',
  'invalid assistant exchange',
  'generated audit rejects an unqualified model identifier'
);

select lives_ok(
  $$
    do $rate$
    declare
      attempt integer;
    begin
      for attempt in 1..18 loop
        perform public.claim_assistant_generation(
          'north-educational-2026-07-30',
          repeat('d', 64),
          '[]'::jsonb,
          20
        );
      end loop;
    end
    $rate$
  $$,
  'reservations consume the documented hourly allowance'
);
select throws_ok(
  $$
    select public.claim_assistant_generation(
      'north-educational-2026-07-30', repeat('e', 64), '[]'::jsonb, 20
    )
  $$,
  'P0001',
  'assistant rate limit',
  'twenty-first provider attempt is blocked before spending'
);

set local role anon;
select throws_ok(
  $$
    select public.save_claimed_assistant_exchange(
      gen_random_uuid(), null, 'Sem sessão', 'Sem sessão', '{}'::jsonb,
      'fallback', 'deterministic-v1',
      'north-educational-2026-07-30', repeat('f', 64), '[]'::jsonb
    )
  $$,
  '42501',
  null,
  'anonymous users cannot finalize reservations'
);

select * from finish();
rollback;
