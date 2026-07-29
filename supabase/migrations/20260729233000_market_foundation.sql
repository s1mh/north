begin;

create type public.market_source_kind as enum ('open_data', 'licensed');
create type public.market_run_status as enum ('running', 'succeeded', 'failed');
create type public.market_alert_severity as enum ('warning', 'critical');

create table public.market_data_sources (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  display_name text not null check (char_length(display_name) between 2 and 100),
  kind public.market_source_kind not null,
  base_url text not null check (base_url ~ '^https://'),
  license_url text not null check (license_url ~ '^https://'),
  attribution text not null check (char_length(attribution) between 2 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.market_indicators (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.market_data_sources(id),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  source_series text not null check (char_length(source_series) between 1 and 80),
  label text not null check (char_length(label) between 2 and 80),
  value numeric(24,8) not null,
  unit text not null check (unit in ('percent_year', 'percent_month', 'brl', 'points')),
  observed_on date not null,
  fetched_at timestamptz not null default now(),
  unique (source_id, code, observed_on)
);

create table public.market_instruments (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.market_data_sources(id),
  source_instrument_id text not null check (char_length(source_instrument_id) between 1 and 100),
  symbol text not null check (char_length(symbol) between 1 and 30),
  name text not null check (char_length(name) between 2 and 120),
  asset_class text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  market text not null check (char_length(market) between 2 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source_id, source_instrument_id)
);

create table public.market_prices (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.market_instruments(id),
  source_id text not null references public.market_data_sources(id),
  observed_at timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  open numeric(24,8),
  high numeric(24,8),
  low numeric(24,8),
  close numeric(24,8) not null check (close >= 0),
  volume numeric(30,8) check (volume >= 0),
  fetched_at timestamptz not null default now(),
  check (open is null or open >= 0),
  check (high is null or high >= 0),
  check (low is null or low >= 0),
  check (high is null or low is null or high >= low),
  unique (instrument_id, source_id, observed_at)
);

create table public.market_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.market_data_sources(id),
  job_key text not null check (char_length(job_key) between 1 and 80),
  status public.market_run_status not null default 'running',
  records_received integer not null default 0 check (records_received >= 0),
  records_written integer not null default 0 check (records_written >= 0),
  error_code text check (error_code is null or error_code ~ '^[a-z][a-z0-9_]{1,79}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (source_id, job_key),
  check (
    (status = 'running' and finished_at is null)
    or (status in ('succeeded', 'failed') and finished_at is not null)
  )
);

create table public.market_data_alerts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.market_ingestion_runs(id),
  source_id text not null references public.market_data_sources(id),
  severity public.market_alert_severity not null,
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,79}$'),
  summary text not null check (char_length(summary) between 3 and 200),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index market_indicators_latest_idx
  on public.market_indicators(code, observed_on desc);
create index market_prices_latest_idx
  on public.market_prices(instrument_id, observed_at desc);
create index market_runs_recent_failures_idx
  on public.market_ingestion_runs(source_id, status, started_at desc);
create index market_alerts_open_idx
  on public.market_data_alerts(source_id, created_at desc)
  where resolved_at is null;

insert into public.market_data_sources (
  id, display_name, kind, base_url, license_url, attribution
) values (
  'bcb-sgs',
  'Banco Central do Brasil · SGS',
  'open_data',
  'https://api.bcb.gov.br',
  'https://www.bcb.gov.br/acessoinformacao/dadosabertos',
  'Fonte: Banco Central do Brasil'
);

alter table public.market_data_sources enable row level security;
alter table public.market_indicators enable row level security;
alter table public.market_instruments enable row level security;
alter table public.market_prices enable row level security;
alter table public.market_ingestion_runs enable row level security;
alter table public.market_data_alerts enable row level security;

revoke all on public.market_data_sources from anon, authenticated;
revoke all on public.market_indicators from anon, authenticated;
revoke all on public.market_instruments from anon, authenticated;
revoke all on public.market_prices from anon, authenticated;
revoke all on public.market_ingestion_runs from anon, authenticated;
revoke all on public.market_data_alerts from anon, authenticated;

grant select on public.market_data_sources to authenticated;
grant select on public.market_indicators to authenticated;
grant select on public.market_instruments to authenticated;
grant select on public.market_prices to authenticated;

create policy market_sources_read_authenticated
  on public.market_data_sources for select to authenticated using (true);
create policy market_indicators_read_authenticated
  on public.market_indicators for select to authenticated using (true);
create policy market_instruments_read_authenticated
  on public.market_instruments for select to authenticated using (true);
create policy market_prices_read_authenticated
  on public.market_prices for select to authenticated using (true);

commit;
