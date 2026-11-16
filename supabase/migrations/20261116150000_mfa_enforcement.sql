begin;

-- Segundo fator (TOTP): quem tem um fator verificado só acessa dados com a sessão em nível aal2.
-- Sem fator verificado, nada muda.

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    );
$$;

create or replace function public.require_mfa()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.mfa_satisfied() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;
end;
$$;

revoke all on function public.mfa_satisfied() from public, anon;
revoke all on function public.require_mfa() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated, service_role;
grant execute on function public.require_mfa() to authenticated, service_role;

-- Códigos de recuperação (guardados só como hash; acesso apenas pelas funções abaixo).
create table public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null check (char_length(code_hash) = 64),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index mfa_recovery_codes_unused_idx on public.mfa_recovery_codes(user_id) where used_at is null;

create table public.mfa_recovery_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index mfa_recovery_attempts_recent_idx on public.mfa_recovery_attempts(user_id, attempted_at desc);

alter table public.mfa_recovery_codes enable row level security;
alter table public.mfa_recovery_attempts enable row level security;
revoke all on table public.mfa_recovery_codes from anon, authenticated;
revoke all on table public.mfa_recovery_attempts from anon, authenticated;

create or replace function public.generate_mfa_recovery_codes()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  codes text[] := '{}';
  code text;
  i integer;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  if not exists (
    select 1 from auth.mfa_factors f where f.user_id = user_id_value and f.status = 'verified'
  ) then
    raise exception using errcode = '22023', message = 'mfa_not_enabled';
  end if;

  delete from public.mfa_recovery_codes where user_id = user_id_value;
  for i in 1..8 loop
    code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
    code := substr(code, 1, 5) || '-' || substr(code, 6, 5);
    codes := codes || code;
    insert into public.mfa_recovery_codes (user_id, code_hash)
    values (user_id_value, encode(extensions.digest(code, 'sha256'), 'hex'));
  end loop;
  return codes;
end;
$$;

create or replace function public.consume_mfa_recovery_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  code_hash_value text;
  used_id uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_code is null or char_length(p_code) > 40 then
    return false;
  end if;

  delete from public.mfa_recovery_attempts where attempted_at < now() - interval '1 day';
  if (
    select count(*) from public.mfa_recovery_attempts
    where user_id = user_id_value and attempted_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'too_many_attempts';
  end if;

  code_hash_value := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  update public.mfa_recovery_codes
  set used_at = now()
  where id = (
    select id from public.mfa_recovery_codes
    where user_id = user_id_value and used_at is null and code_hash = code_hash_value
    limit 1
  )
  returning id into used_id;

  if used_id is null then
    insert into public.mfa_recovery_attempts (user_id) values (user_id_value);
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.generate_mfa_recovery_codes() from public, anon;
revoke all on function public.consume_mfa_recovery_code(text) from public, anon;
grant execute on function public.generate_mfa_recovery_codes() to authenticated;
grant execute on function public.consume_mfa_recovery_code(text) to authenticated;

-- Política restritiva em todas as tabelas públicas com RLS.
do $$
declare
  target record;
begin
  for target in
    select schemaname, tablename from pg_tables where schemaname = 'public' and rowsecurity
  loop
    execute format('drop policy if exists mfa_required on %I.%I', target.schemaname, target.tablename);
    execute format(
      'create policy mfa_required on %I.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      target.schemaname, target.tablename
    );
  end loop;
end;
$$;

-- As funções de escrita são SECURITY DEFINER e ignoram o RLS: cada uma passa a exigir o segundo fator.
do $$
declare
  target record;
  definition text;
  updated text;
  patched integer := 0;
begin
  for target in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_assistant_generation', 'complete_suitability', 'correct_portfolio_transaction',
        'create_goal_with_plan', 'create_portfolio_asset', 'delete_assistant_thread',
        'export_current_user_data', 'record_goal_contribution', 'record_portfolio_transaction',
        'request_institution_research', 'reverse_goal_contribution', 'reverse_portfolio_transaction',
        'save_assistant_exchange', 'save_claimed_assistant_exchange', 'save_investment_simulation',
        'set_theme_preference', 'sync_user_institutions'
      )
  loop
    definition := pg_get_functiondef(target.oid);
    if definition like '%require_mfa%' then
      patched := patched + 1;
      continue;
    end if;
    updated := regexp_replace(definition, E'(\\n\\s*begin\\s*\\n)', E'\\1  perform public.require_mfa();\n', 'i');
    if updated = definition then
      raise exception 'não foi possível proteger a função %', target.proname;
    end if;
    execute updated;
    patched := patched + 1;
  end loop;
  if patched <> 17 then
    raise exception 'esperava proteger 17 funções, protegi %', patched;
  end if;
end;
$$;

commit;
