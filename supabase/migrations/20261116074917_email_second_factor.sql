begin;

-- Segundo fator por código enviado ao e-mail (o Supabase só oferece app autenticador e SMS).
-- Quem confirma o código marca a SESSÃO (session_id do JWT) como verificada.

create table public.user_security_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_2fa_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.email_2fa_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  purpose text not null check (purpose in ('login', 'enable')),
  code_hash text not null check (char_length(code_hash) = 64),
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_2fa_challenges_user_idx on public.email_2fa_challenges(user_id, created_at desc);

create table public.email_2fa_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);
create index email_2fa_sessions_user_idx on public.email_2fa_sessions(user_id);

alter table public.user_security_settings enable row level security;
alter table public.email_2fa_challenges enable row level security;
alter table public.email_2fa_sessions enable row level security;
revoke all on table public.user_security_settings from anon, authenticated;
revoke all on table public.email_2fa_challenges from anon, authenticated;
revoke all on table public.email_2fa_sessions from anon, authenticated;

-- Regra única de acesso: app autenticador (aal2) tem prioridade; senão, código por e-mail na sessão.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
    ) then coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    when exists (
      select 1 from public.user_security_settings s
      where s.user_id = auth.uid() and s.email_2fa_enabled
    ) then exists (
      select 1 from public.email_2fa_sessions e
      where e.user_id = auth.uid()
        and e.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    )
    else true
  end;
$$;

create or replace function public.second_factor_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'method', case
      when exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified') then 'totp'
      when exists (select 1 from public.user_security_settings s where s.user_id = auth.uid() and s.email_2fa_enabled) then 'email'
      else null
    end,
    'satisfied', public.mfa_satisfied()
  );
$$;
revoke all on function public.second_factor_status() from public, anon;
grant execute on function public.second_factor_status() to authenticated;

-- Funções só do servidor (chave de serviço): geram e conferem o código.
create or replace function public.email_2fa_issue(
  p_user_id uuid, p_session_id uuid, p_purpose text, p_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_id uuid := gen_random_uuid();
begin
  delete from public.email_2fa_challenges where created_at < now() - interval '1 day';
  delete from public.email_2fa_sessions where verified_at < now() - interval '60 days';
  if (
    select count(*) from public.email_2fa_challenges
    where user_id = p_user_id and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'too_many_requests';
  end if;
  update public.email_2fa_challenges set consumed_at = now()
  where user_id = p_user_id and consumed_at is null;
  insert into public.email_2fa_challenges (id, user_id, session_id, purpose, code_hash, expires_at)
  values (
    challenge_id, p_user_id, p_session_id, p_purpose,
    encode(extensions.digest(p_code || ':' || challenge_id::text, 'sha256'), 'hex'),
    now() + interval '10 minutes'
  );
  return challenge_id;
end;
$$;

create or replace function public.email_2fa_check(
  p_user_id uuid, p_session_id uuid, p_purpose text, p_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge record;
begin
  select * into challenge from public.email_2fa_challenges
  where user_id = p_user_id and session_id = p_session_id and purpose = p_purpose
    and consumed_at is null and expires_at > now()
  order by created_at desc limit 1
  for update;
  if not found then
    return false;
  end if;
  if challenge.attempts >= 5 then
    raise exception using errcode = '54000', message = 'too_many_attempts';
  end if;
  if challenge.code_hash <> encode(extensions.digest(trim(p_code) || ':' || challenge.id::text, 'sha256'), 'hex') then
    update public.email_2fa_challenges set attempts = attempts + 1 where id = challenge.id;
    return false;
  end if;
  update public.email_2fa_challenges set consumed_at = now() where id = challenge.id;
  insert into public.email_2fa_sessions (session_id, user_id)
  values (p_session_id, p_user_id) on conflict (session_id) do nothing;
  if p_purpose = 'enable' then
    insert into public.user_security_settings (user_id, email_2fa_enabled)
    values (p_user_id, true)
    on conflict (user_id) do update set email_2fa_enabled = true, updated_at = now();
  end if;
  return true;
end;
$$;

revoke all on function public.email_2fa_issue(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.email_2fa_check(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.email_2fa_issue(uuid, uuid, text, text) to service_role;
grant execute on function public.email_2fa_check(uuid, uuid, text, text) to service_role;

-- Desligar o código por e-mail exige a sessão já verificada.
create or replace function public.disable_email_2fa()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  update public.user_security_settings set email_2fa_enabled = false, updated_at = now()
  where user_id = auth.uid();
  delete from public.email_2fa_sessions where user_id = auth.uid();
end;
$$;
revoke all on function public.disable_email_2fa() from public, anon;
grant execute on function public.disable_email_2fa() to authenticated;

-- Política restritiva também nas tabelas novas (mesmo padrão da migração anterior).
do $$
declare
  target record;
begin
  for target in
    select schemaname, tablename from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('user_security_settings', 'email_2fa_challenges', 'email_2fa_sessions')
  loop
    execute format('drop policy if exists mfa_required on %I.%I', target.schemaname, target.tablename);
    execute format(
      'create policy mfa_required on %I.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      target.schemaname, target.tablename
    );
  end loop;
end;
$$;

commit;
