begin;
set local role postgres;
set local search_path = public, extensions;

create extension if not exists pgtap;
select plan(20);

select has_table('public'::name, 'investment_simulations'::name);
select has_function(
  'public'::name,
  'save_investment_simulation'::name,
  array[
    'text', 'uuid', 'text', 'numeric', 'integer',
    'numeric', 'numeric', 'numeric', 'jsonb'
  ]::name[]
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'iris@example.test', '', now(),
  '{"display_name":"Iris","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'joao@example.test', '', now(),
  '{"display_name":"João","consent_terms_version":"2026-07-28","consent_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000010', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.save_investment_simulation(
      'free', null, 'once', 5000, 12, 8, 4, 0.5,
      '{"Renda Fixa":40,"Ações · ETF":25,"FIIs":15,"Internacional":10,"Cripto":10}'::jsonb
    )
  $$,
  'owner saves a free simulation'
);
select is((select count(*) from public.investment_simulations), 1::bigint, 'owner reads own simulation');
select is(
  (select contribution_amount from public.investment_simulations limit 1),
  5000.00::numeric,
  'money remains exact numeric'
);
select is(
  (select assumptions_version from public.investment_simulations limit 1),
  '2026-07-28',
  'assumptions are versioned'
);
select throws_ok(
  $$
    insert into public.investment_simulations (
      user_id, mode, frequency, contribution_amount, horizon_months,
      annual_return_rate, annual_inflation_rate, annual_fee_rate, allocation
    ) values (
      '00000000-0000-0000-0000-000000000010',
      'free', 'once', 1, 12, 8, 4, 0,
      '{"Renda Fixa":100}'::jsonb
    )
  $$,
  '42501',
  null,
  'direct inserts cannot bypass validated function'
);
select throws_ok(
  $$
    update public.investment_simulations set contribution_amount = 1
  $$,
  '42501',
  null,
  'saved simulations are immutable'
);
select throws_ok(
  $$
    delete from public.investment_simulations
  $$,
  '42501',
  null,
  'saved simulations cannot be deleted directly'
);
select throws_ok(
  $$
    select public.save_investment_simulation(
      'free', null, 'once', 5000, 12, 8, 4, 0.5,
      '{"Renda Fixa":99}'::jsonb
    )
  $$,
  '22023',
  'invalid simulation',
  'allocation must total 100 percent'
);
select throws_ok(
  $$
    select public.save_investment_simulation(
      'free', null, 'once', 5000, 0, 8, 4, 0.5,
      '{"Renda Fixa":100}'::jsonb
    )
  $$,
  '22023',
  'invalid simulation',
  'horizon cannot be zero'
);
select throws_ok(
  $$
    select public.save_investment_simulation(
      'free', null, 'once', 5000, 12, 2, 4, 3,
      '{"Renda Fixa":100}'::jsonb
    )
  $$,
  '22023',
  'invalid simulation',
  'fees cannot exceed assumed return'
);
select throws_ok(
  $$
    select public.save_investment_simulation(
      'free', null, 'once', 5000, 12, 8, 4, 0.5,
      '{"Produto inventado":100}'::jsonb
    )
  $$,
  '22023',
  'invalid simulation',
  'allocation only accepts supported educational classes'
);

select lives_ok(
  $$
    select public.create_goal_with_plan(
      'Casa', 'imovel', 300000,
      ((now() at time zone 'America/Sao_Paulo')::date + interval '5 years')::date,
      2500
    )
  $$,
  'owner creates a goal for linked simulation'
);
select set_config('test.goal_id', (select id::text from public.goals limit 1), true);
select lives_ok(
  format(
    $$
      select public.save_investment_simulation(
        'goal', %L::uuid, 'monthly', 2500, 60, 8, 4, 0.5,
        '{"Renda Fixa":70,"Fundos":15,"Internacional":10,"Ações · ETF":5}'::jsonb
      )
    $$,
    current_setting('test.goal_id')
  ),
  'owner links simulation to own active goal'
);
select is((select count(*) from public.investment_simulations), 2::bigint, 'both owner simulations remain readable');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select is((select count(*) from public.investment_simulations), 0::bigint, 'another user cannot read simulations');
select throws_ok(
  format(
    $$
      select public.save_investment_simulation(
        'goal', %L::uuid, 'monthly', 2500, 60, 8, 4, 0.5,
        '{"Renda Fixa":100}'::jsonb
      )
    $$,
    current_setting('test.goal_id')
  ),
  '42501',
  'goal not available',
  'another user cannot link the owner goal'
);

set local role postgres;
set local role anon;
select throws_ok(
  $$ select * from public.investment_simulations $$,
  '42501',
  null,
  'anonymous users cannot read simulations'
);
select throws_ok(
  $$
    select public.save_investment_simulation(
      'free', null, 'once', 5000, 12, 8, 4, 0.5,
      '{"Renda Fixa":100}'::jsonb
    )
  $$,
  '42501',
  null,
  'anonymous users cannot save simulations'
);

select * from finish();
rollback;
