begin;

revoke all on schema public from public;
grant usage on schema public to authenticated;

create type public.theme_preference as enum ('system', 'light', 'dark');
create type public.onboarding_status as enum ('account', 'consent', 'suitability', 'complete');
create type public.investor_profile as enum ('conservador', 'moderado', 'arrojado');
create type public.goal_status as enum ('active', 'paused', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  locale text not null default 'pt-BR' check (locale = 'pt-BR'),
  theme public.theme_preference not null default 'system',
  onboarding public.onboarding_status not null default 'account',
  current_assessment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy')),
  document_version text not null check (char_length(document_version) between 1 and 30),
  source text not null default 'web' check (source in ('web', 'support')),
  accepted_at timestamptz not null default now(),
  unique (user_id, document_type, document_version)
);

create table public.suitability_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questionnaire_version text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  score smallint not null check (score between 0 and 100),
  profile public.investor_profile not null,
  target_allocation jsonb not null check (jsonb_typeof(target_allocation) = 'object'),
  reason text not null check (reason in ('onboarding', 'reassessment')),
  completed_at timestamptz not null default now()
);

alter table public.profiles add constraint profiles_current_assessment_fk foreign key (current_assessment_id) references public.suitability_assessments(id) on delete set null;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  kind text not null check (kind in ('aposentadoria','viagem','imovel','carro','reserva','personalizada')),
  target_amount numeric(19,2) not null check (target_amount > 0),
  target_date date not null,
  planned_monthly_amount numeric(19,2) check (planned_monthly_amount >= 0),
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consent_records_user_idx on public.consent_records(user_id);
create index suitability_assessments_user_completed_idx on public.suitability_assessments(user_id, completed_at desc);
create index goals_user_status_idx on public.goals(user_id, status);

alter table public.profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.suitability_assessments enable row level security;
alter table public.goals enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select, insert on public.suitability_assessments to authenticated;
grant select, insert, update, delete on public.goals to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy consent_select_own on public.consent_records for select to authenticated using ((select auth.uid()) = user_id);
create policy consent_insert_own on public.consent_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assessments_select_own on public.suitability_assessments for select to authenticated using ((select auth.uid()) = user_id);
create policy assessments_insert_own on public.suitability_assessments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_select_own on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

commit;
