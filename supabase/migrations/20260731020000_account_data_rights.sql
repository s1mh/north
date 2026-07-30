begin;

alter table public.portfolio_instruments
  drop constraint portfolio_instruments_institution_id_fkey,
  add constraint portfolio_instruments_institution_id_fkey
    foreign key (institution_id)
    references public.portfolio_institutions(id)
    on delete cascade;

alter table public.portfolio_transactions
  drop constraint portfolio_transactions_instrument_id_fkey,
  add constraint portfolio_transactions_instrument_id_fkey
    foreign key (instrument_id)
    references public.portfolio_instruments(id)
    on delete cascade;

create table public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type = 'account_deleted'),
  occurred_at timestamptz not null default now()
);

alter table public.account_security_events enable row level security;
revoke all on public.account_security_events from public, anon, authenticated;

create or replace function public.log_account_deletion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_security_events (event_type)
  values ('account_deleted');
  return old;
end;
$$;

revoke all on function public.log_account_deletion_event() from public, anon, authenticated;

create trigger account_deleted_security_event
after delete on auth.users
for each row execute function public.log_account_deletion_event();

create or replace function public.export_current_user_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return jsonb_build_object(
    'schema_version', '2026-07-31',
    'exported_at', statement_timestamp(),
    'account', (
      select jsonb_build_object(
        'id', account.id,
        'email', account.email,
        'created_at', account.created_at,
        'updated_at', account.updated_at,
        'last_sign_in_at', account.last_sign_in_at
      )
      from auth.users account
      where account.id = user_id_value
    ),
    'profile', (
      select to_jsonb(profile)
      from public.profiles profile
      where profile.id = user_id_value
    ),
    'data', jsonb_build_object(
      'consents', coalesce((
        select jsonb_agg(to_jsonb(record) order by record.accepted_at, record.id)
        from public.consent_records record
        where record.user_id = user_id_value
      ), '[]'::jsonb),
      'suitability_assessments', coalesce((
        select jsonb_agg(to_jsonb(assessment) order by assessment.completed_at, assessment.id)
        from public.suitability_assessments assessment
        where assessment.user_id = user_id_value
      ), '[]'::jsonb),
      'linked_institutions', coalesce((
        select jsonb_agg(
          to_jsonb(link) || jsonb_build_object(
            'institution', jsonb_build_object(
              'slug', institution.slug,
              'name', institution.name,
              'jurisdiction', institution.jurisdiction
            )
          )
          order by link.created_at, link.institution_id
        )
        from public.user_institutions link
        join public.institutions institution on institution.id = link.institution_id
        where link.user_id = user_id_value
      ), '[]'::jsonb),
      'institution_research_requests', coalesce((
        select jsonb_agg(to_jsonb(request) order by request.created_at, request.id)
        from public.institution_research_requests request
        where request.user_id = user_id_value
      ), '[]'::jsonb),
      'portfolio_institutions', coalesce((
        select jsonb_agg(to_jsonb(institution) order by institution.created_at, institution.id)
        from public.portfolio_institutions institution
        where institution.user_id = user_id_value
      ), '[]'::jsonb),
      'portfolio_instruments', coalesce((
        select jsonb_agg(to_jsonb(instrument) order by instrument.created_at, instrument.id)
        from public.portfolio_instruments instrument
        where instrument.user_id = user_id_value
      ), '[]'::jsonb),
      'portfolio_transactions', coalesce((
        select jsonb_agg(to_jsonb(transaction) order by transaction.trade_date, transaction.created_at, transaction.id)
        from public.portfolio_transactions transaction
        where transaction.user_id = user_id_value
      ), '[]'::jsonb),
      'goals', coalesce((
        select jsonb_agg(to_jsonb(goal) order by goal.created_at, goal.id)
        from public.goals goal
        where goal.user_id = user_id_value
      ), '[]'::jsonb),
      'goal_contributions', coalesce((
        select jsonb_agg(to_jsonb(contribution) order by contribution.contributed_on, contribution.created_at, contribution.id)
        from public.goal_contributions contribution
        where contribution.user_id = user_id_value
      ), '[]'::jsonb),
      'contribution_plans', coalesce((
        select jsonb_agg(to_jsonb(plan) order by plan.created_at, plan.id)
        from public.contribution_plans plan
        where plan.user_id = user_id_value
      ), '[]'::jsonb),
      'investment_simulations', coalesce((
        select jsonb_agg(to_jsonb(simulation) order by simulation.created_at, simulation.id)
        from public.investment_simulations simulation
        where simulation.user_id = user_id_value
      ), '[]'::jsonb),
      'assistant_threads', coalesce((
        select jsonb_agg(to_jsonb(thread) order by thread.created_at, thread.id)
        from public.assistant_threads thread
        where thread.user_id = user_id_value
      ), '[]'::jsonb),
      'assistant_messages', coalesce((
        select jsonb_agg(to_jsonb(message) order by message.created_at, message.id)
        from public.assistant_messages message
        where message.user_id = user_id_value
      ), '[]'::jsonb),
      'ai_generations', coalesce((
        select jsonb_agg(to_jsonb(generation) order by generation.created_at, generation.id)
        from public.ai_generations generation
        where generation.user_id = user_id_value
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.export_current_user_data() from public, anon;
grant execute on function public.export_current_user_data() to authenticated;

commit;
