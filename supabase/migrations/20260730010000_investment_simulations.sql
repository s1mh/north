begin;

create table public.investment_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete cascade,
  mode text not null check (mode in ('free', 'goal')),
  frequency text not null check (frequency in ('once', 'monthly')),
  contribution_amount numeric(19,2) not null check (contribution_amount > 0),
  horizon_months integer not null check (horizon_months between 1 and 600),
  annual_return_rate numeric(5,2) not null check (annual_return_rate between 0 and 30),
  annual_inflation_rate numeric(5,2) not null check (annual_inflation_rate between 0 and 20),
  annual_fee_rate numeric(5,2) not null check (
    annual_fee_rate between 0 and 10
    and annual_fee_rate <= annual_return_rate
  ),
  allocation jsonb not null check (jsonb_typeof(allocation) = 'object'),
  assumptions_version text not null default '2026-07-28',
  created_at timestamptz not null default now(),
  check (
    (mode = 'free' and goal_id is null)
    or (mode = 'goal' and goal_id is not null)
  )
);

create index investment_simulations_user_created_idx
  on public.investment_simulations(user_id, created_at desc);
create index investment_simulations_goal_idx
  on public.investment_simulations(goal_id)
  where goal_id is not null;

alter table public.investment_simulations enable row level security;
revoke all on public.investment_simulations from anon, authenticated;
grant select on public.investment_simulations to authenticated;

create policy investment_simulations_select_own
  on public.investment_simulations for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_investment_simulation(
  p_mode text,
  p_goal_id uuid,
  p_frequency text,
  p_contribution_amount numeric,
  p_horizon_months integer,
  p_annual_return_rate numeric,
  p_annual_inflation_rate numeric,
  p_annual_fee_rate numeric,
  p_allocation jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  simulation_id uuid;
  allocation_total numeric;
  allocation_valid boolean;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select
    count(*) between 1 and 6
    and coalesce(bool_and(
      jsonb_typeof(value) = 'number'
      and (value #>> '{}')::numeric between 0 and 100
      and trunc((value #>> '{}')::numeric) = (value #>> '{}')::numeric
      and key in (
        'Renda Fixa', 'Fundos', 'Ações · ETF',
        'FIIs', 'Internacional', 'Cripto'
      )
    ), false),
    coalesce(sum((value #>> '{}')::numeric), 0)
  into allocation_valid, allocation_total
  from jsonb_each(coalesce(p_allocation, '{}'::jsonb));

  if p_mode not in ('free', 'goal')
    or p_frequency not in ('once', 'monthly')
    or p_contribution_amount <= 0
    or p_contribution_amount > 999999999999999.99
    or p_horizon_months not between 1 and 600
    or p_annual_return_rate not between 0 and 30
    or p_annual_inflation_rate not between 0 and 20
    or p_annual_fee_rate not between 0 and 10
    or p_annual_fee_rate > p_annual_return_rate
    or allocation_valid is not true
    or allocation_total <> 100
    or (p_mode = 'free' and p_goal_id is not null)
    or (p_mode = 'goal' and p_goal_id is null)
  then
    raise exception using errcode = '22023', message = 'invalid simulation';
  end if;

  if p_goal_id is not null and not exists (
    select 1
    from public.goals
    where id = p_goal_id
      and user_id = user_id_value
      and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'goal not available';
  end if;

  insert into public.investment_simulations (
    user_id,
    goal_id,
    mode,
    frequency,
    contribution_amount,
    horizon_months,
    annual_return_rate,
    annual_inflation_rate,
    annual_fee_rate,
    allocation
  )
  values (
    user_id_value,
    p_goal_id,
    p_mode,
    p_frequency,
    p_contribution_amount,
    p_horizon_months,
    p_annual_return_rate,
    p_annual_inflation_rate,
    p_annual_fee_rate,
    p_allocation
  )
  returning id into simulation_id;

  return simulation_id;
end;
$$;

revoke all on function public.save_investment_simulation(
  text, uuid, text, numeric, integer, numeric, numeric, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.save_investment_simulation(
  text, uuid, text, numeric, integer, numeric, numeric, numeric, jsonb
) to authenticated;

commit;
