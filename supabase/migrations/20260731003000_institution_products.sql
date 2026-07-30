begin;

create type public.catalog_review_status as enum (
  'queued', 'reviewing', 'promoted', 'rejected'
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,50}$'),
  name text not null unique check (char_length(trim(name)) between 2 and 80),
  initial text not null check (char_length(initial) = 1),
  color_token text not null check (
    color_token in ('rf', 'ac', 'fi', 'intl', 'cr', 'fu', 'cx')
  ),
  jurisdiction text not null default 'BR' check (jurisdiction = 'BR'),
  official_host text not null unique check (
    official_host ~ '^[a-z0-9.-]+$'
    and official_host !~ '(^|\.)(localhost|local|internal)$'
  ),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_institutions (
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id),
  created_at timestamptz not null default now(),
  primary key (user_id, institution_id)
);

create table public.institution_research_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_name text not null check (
    requested_name = trim(requested_name)
    and char_length(requested_name) between 2 and 80
    and requested_name !~* '(https?://|www\.|@)'
  ),
  normalized_name text not null check (
    normalized_name = lower(trim(normalized_name))
    and char_length(normalized_name) between 2 and 80
  ),
  status public.catalog_review_status not null default 'queued',
  reviewed_institution_id uuid references public.institutions(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, normalized_name)
);

create table public.investment_products (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  asset_class public.asset_class not null,
  summary text not null check (char_length(summary) between 10 and 240),
  return_description text not null check (
    char_length(return_description) between 2 and 100
  ),
  liquidity text not null check (char_length(liquidity) between 2 and 100),
  maturity text not null check (char_length(maturity) between 2 and 100),
  minimum_amount numeric(19,2) check (minimum_amount is null or minimum_amount >= 0),
  protection text not null check (char_length(protection) between 2 and 100),
  educational_comparison text not null check (
    char_length(educational_comparison) between 20 and 500
  ),
  source_url text not null check (
    source_url ~ '^https://[a-z0-9.-]+/'
  ),
  source_label text not null check (char_length(source_label) between 2 and 120),
  jurisdiction text not null default 'BR' check (jurisdiction = 'BR'),
  verified_at date not null,
  review_due_at date not null check (review_due_at >= verified_at),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (institution_id, slug)
);

create or replace function public.validate_product_source_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_host text := lower(substring(new.source_url from '^https://([^/]+)/'));
  allowed_host text;
begin
  select official_host into allowed_host
  from public.institutions
  where id = new.institution_id and active;

  if allowed_host is null
    or (
      source_host <> allowed_host
      and source_host not like '%.' || allowed_host
    )
  then
    raise exception using errcode = '22023', message = 'source host not allowed';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_product_source_host()
  from public, anon, authenticated;

create trigger validate_investment_product_source
before insert or update of institution_id, source_url
on public.investment_products
for each row execute function public.validate_product_source_host();

create index user_institutions_user_idx
  on public.user_institutions(user_id);
create index institution_requests_user_created_idx
  on public.institution_research_requests(user_id, created_at desc);
create index investment_products_institution_idx
  on public.investment_products(institution_id, asset_class);

alter table public.institutions enable row level security;
alter table public.user_institutions enable row level security;
alter table public.institution_research_requests enable row level security;
alter table public.investment_products enable row level security;

revoke all on public.institutions from public, anon, authenticated;
revoke all on public.user_institutions from public, anon, authenticated;
revoke all on public.institution_research_requests from public, anon, authenticated;
revoke all on public.investment_products from public, anon, authenticated;
grant select on public.institutions to authenticated;
grant select on public.user_institutions to authenticated;
grant select on public.institution_research_requests to authenticated;
grant select on public.investment_products to authenticated;

create policy institutions_authenticated_read
  on public.institutions for select to authenticated
  using (active);
create policy user_institutions_read_own
  on public.user_institutions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy institution_requests_read_own
  on public.institution_research_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy investment_products_authenticated_read
  on public.investment_products for select to authenticated
  using (
    active
    and exists (
      select 1 from public.institutions
      where institutions.id = investment_products.institution_id
        and institutions.active
    )
  );

create or replace function public.sync_user_institutions(p_institution_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  selected_count integer;
  input_count integer;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select count(distinct value), count(*)
  into selected_count, input_count
  from unnest(coalesce(p_institution_ids, '{}'::uuid[])) as value;

  if selected_count = 0
    or selected_count > 10
    or selected_count <> input_count
    or exists (
      select 1
      from unnest(p_institution_ids) as selected_id
      where not exists (
        select 1 from public.institutions
        where id = selected_id and active
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid institutions';
  end if;

  delete from public.user_institutions
  where user_id = user_id_value
    and institution_id <> all(p_institution_ids);

  insert into public.user_institutions (user_id, institution_id)
  select user_id_value, selected_id
  from unnest(p_institution_ids) as selected_id
  on conflict do nothing;
end;
$$;

create or replace function public.request_institution_research(p_requested_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  clean_name text := trim(regexp_replace(coalesce(p_requested_name, ''), '\s+', ' ', 'g'));
  normalized_value text;
  request_id uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  normalized_value := lower(clean_name);
  if char_length(clean_name) not between 2 and 80
    or clean_name ~* '(https?://|www\.|@)'
    or clean_name ~ '[<>{}]'
  then
    raise exception using errcode = '22023', message = 'invalid institution request';
  end if;

  if exists (
    select 1 from public.institutions
    where lower(name) = normalized_value and active
  ) then
    raise exception using errcode = '23505', message = 'institution already available';
  end if;

  if (
    select count(*) from public.institution_research_requests
    where user_id = user_id_value
      and created_at >= now() - interval '24 hours'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'institution request limit';
  end if;

  insert into public.institution_research_requests (
    user_id, requested_name, normalized_name
  ) values (
    user_id_value, clean_name, normalized_value
  )
  on conflict (user_id, normalized_name) do update
    set requested_name = excluded.requested_name
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.sync_user_institutions(uuid[])
  from public, anon, authenticated;
grant execute on function public.sync_user_institutions(uuid[])
  to authenticated;
revoke all on function public.request_institution_research(text)
  from public, anon, authenticated;
grant execute on function public.request_institution_research(text)
  to authenticated;

insert into public.institutions (
  slug, name, initial, color_token, official_host
) values
  ('nubank', 'Nubank', 'N', 'cr', 'nubank.com.br'),
  ('itau', 'Itaú', 'I', 'intl', 'itau.com.br'),
  ('btg-pactual', 'BTG Pactual', 'B', 'rf', 'btgpactual.com'),
  ('xp-investimentos', 'XP Investimentos', 'X', 'ac', 'xp.com.br'),
  ('c6-bank', 'C6 Bank', 'C', 'fi', 'c6bank.com.br');

insert into public.investment_products (
  institution_id, slug, name, asset_class, summary, return_description,
  liquidity, maturity, minimum_amount, protection, educational_comparison,
  source_url, source_label, verified_at, review_due_at
)
select
  id,
  'caixinha-rdb-imediato',
  'Caixinha com RDB Imediato',
  'renda_fixa',
  'RDB pós-fixado usado na Caixinha “Para poupar”, com acesso imediato ao saldo.',
  'Acompanha 100% do CDI',
  'Imediata',
  'Sem prazo exibido na fonte',
  null,
  'FGC, sujeito aos limites aplicáveis',
  'A liquidez imediata favorece objetivos de curto prazo e reserva. Compare tributação, limites do FGC e disponibilidade no seu app antes de decidir.',
  'https://nubank.com.br/ultravioleta/conta/caixinhas',
  'Nubank · Caixinhas',
  '2026-07-30',
  '2026-10-30'
from public.institutions where slug = 'nubank';

insert into public.investment_products (
  institution_id, slug, name, asset_class, summary, return_description,
  liquidity, maturity, minimum_amount, protection, educational_comparison,
  source_url, source_label, verified_at, review_due_at
)
select
  id,
  'cdb-di',
  'CDB-DI',
  'renda_fixa',
  'CDB pós-fixado do Itaú voltado a reserva e à parcela conservadora da carteira.',
  'Percentual do CDI definido na aplicação',
  'Resgate diário; crédito no mesmo dia',
  'Até 5 anos, conforme contratação',
  1,
  'FGC, sujeito aos limites aplicáveis',
  'A liquidez diária pode atender necessidades de curto prazo. A taxa exata depende da contratação; confira no app, além de tributação e limites do FGC.',
  'https://www.itau.com.br/personnalite/investimentos/renda-fixa/cdb/cdbdi',
  'Itaú Personnalité · CDB-DI',
  '2026-07-30',
  '2026-10-30'
from public.institutions where slug = 'itau';

commit;
