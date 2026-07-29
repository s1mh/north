begin;

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(19,2) not null check (amount > 0),
  contributed_on date not null,
  note text check (note is null or char_length(trim(note)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.contribution_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null unique references public.goals(id) on delete cascade,
  amount numeric(19,2) not null check (amount > 0),
  frequency text not null default 'monthly' check (frequency = 'monthly'),
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  starts_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goal_contributions_goal_date_idx
  on public.goal_contributions(goal_id, contributed_on desc, created_at desc);
create index contribution_plans_user_status_idx
  on public.contribution_plans(user_id, status);

alter table public.goal_contributions enable row level security;
alter table public.contribution_plans enable row level security;

revoke all on public.goal_contributions from anon, authenticated;
revoke all on public.contribution_plans from anon, authenticated;
grant select on public.goal_contributions to authenticated;
grant select on public.contribution_plans to authenticated;

create policy goal_contributions_select_own
  on public.goal_contributions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy contribution_plans_select_own
  on public.contribution_plans for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_goal_with_plan(
  p_name text,
  p_kind text,
  p_target_amount numeric,
  p_target_date date,
  p_planned_monthly_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  goal_id_value uuid;
  today_value date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if char_length(trim(p_name)) not between 2 and 80
    or p_kind not in ('aposentadoria','viagem','imovel','carro','reserva','personalizada')
    or p_target_amount is null
    or p_target_amount <= 0
    or p_target_date is null
    or p_target_date <= today_value
    or p_planned_monthly_amount is null
    or p_planned_monthly_amount < 0 then
    raise exception using errcode = '22023', message = 'invalid goal';
  end if;

  insert into public.goals (
    user_id, name, kind, target_amount, target_date, planned_monthly_amount
  ) values (
    user_id_value, trim(p_name), p_kind, p_target_amount, p_target_date, p_planned_monthly_amount
  )
  returning id into goal_id_value;

  if p_planned_monthly_amount > 0 then
    insert into public.contribution_plans (
      user_id, goal_id, amount, starts_on
    ) values (
      user_id_value, goal_id_value, p_planned_monthly_amount, today_value
    );
  end if;

  return goal_id_value;
end;
$$;

create or replace function public.record_goal_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_contributed_on date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  contribution_id_value uuid;
  today_value date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1 from public.goals
    where id = p_goal_id and user_id = user_id_value and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'goal not available';
  end if;

  if p_amount is null
    or p_amount <= 0
    or p_contributed_on is null
    or p_contributed_on > today_value
    or (p_note is not null and char_length(trim(p_note)) not between 2 and 120) then
    raise exception using errcode = '22023', message = 'invalid contribution';
  end if;

  insert into public.goal_contributions (
    user_id, goal_id, amount, contributed_on, note
  ) values (
    user_id_value, p_goal_id, p_amount, p_contributed_on, nullif(trim(p_note), '')
  )
  returning id into contribution_id_value;

  return contribution_id_value;
end;
$$;

revoke all on function public.create_goal_with_plan(text, text, numeric, date, numeric)
  from public, anon;
revoke all on function public.record_goal_contribution(uuid, numeric, date, text)
  from public, anon;
grant execute on function public.create_goal_with_plan(text, text, numeric, date, numeric)
  to authenticated;
grant execute on function public.record_goal_contribution(uuid, numeric, date, text)
  to authenticated;

commit;
