begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(12);

select has_function(
  'public'::name,
  'complete_suitability'::name,
  array['jsonb', 'text']::name[]
);

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
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dora@example.test',
  '',
  now(),
  '{"display_name":"Dora","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(),
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.complete_suitability(
      '{
        "objetivo":"equilibrar",
        "prazo":"2-a-5",
        "reserva":"parcial",
        "queda":"espero",
        "experiencia":"ate-2",
        "conhecimento":"basico",
        "renda":"parcial",
        "dependencia":"talvez",
        "oscilacao":"ate-10",
        "decisao":"avalio",
        "diversificacao":"ate-30",
        "prioridade":"equilibrio"
      }'::jsonb,
      '2026-07-28'
    )
  $$,
  'authenticated user completes suitability'
);

select is(
  (select count(*) from public.suitability_assessments),
  1::bigint,
  'assessment is visible to its owner'
);
select is(
  (select profile::text from public.suitability_assessments),
  'moderado',
  'profile is calculated in the database'
);
select is(
  (select reason from public.suitability_assessments),
  'onboarding',
  'first assessment records onboarding reason'
);
select is(
  (select onboarding::text from public.profiles),
  'complete',
  'profile advances to complete'
);
select ok(
  (select current_assessment_id is not null from public.profiles),
  'profile points to the current assessment'
);

select lives_ok(
  $$
    select public.complete_suitability(
      '{
        "objetivo":"equilibrar",
        "prazo":"2-a-5",
        "reserva":"parcial",
        "queda":"espero",
        "experiencia":"ate-2",
        "conhecimento":"basico",
        "renda":"parcial",
        "dependencia":"talvez",
        "oscilacao":"ate-10",
        "decisao":"avalio",
        "diversificacao":"ate-30",
        "prioridade":"equilibrio"
      }'::jsonb,
      '2026-07-28'
    )
  $$,
  'authenticated user can reassess'
);
select is(
  (select count(*) from public.suitability_assessments),
  2::bigint,
  'reassessment preserves the audit history'
);
select is(
  (
    select assessment.reason
    from public.profiles profile
    join public.suitability_assessments assessment
      on assessment.id = profile.current_assessment_id
  ),
  'reassessment',
  'profile points to the reassessment'
);

select throws_ok(
  $$
    insert into public.suitability_assessments (
      user_id, questionnaire_version, answers, score, profile, target_allocation, reason
    ) values (
      '00000000-0000-0000-0000-000000000004',
      'fake',
      '{}'::jsonb,
      100,
      'arrojado',
      '{}'::jsonb,
      'reassessment'
    )
  $$,
  '42501',
  null,
  'browser cannot forge a calculated assessment'
);

select throws_ok(
  $$ select public.complete_suitability('{}'::jsonb, '2026-07-28') $$,
  '22023',
  'invalid questionnaire',
  'incomplete questionnaire is rejected'
);

select * from finish();
rollback;
