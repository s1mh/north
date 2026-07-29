begin;

create type public.asset_class as enum (
  'renda_fixa',
  'acoes',
  'fundos',
  'fiis',
  'internacional',
  'cripto',
  'outros'
);

create type public.portfolio_transaction_type as enum (
  'compra',
  'venda',
  'aporte',
  'resgate',
  'rendimento',
  'taxa',
  'ajuste'
);

create table public.portfolio_institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.portfolio_instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.portfolio_institutions(id),
  symbol text not null check (char_length(trim(symbol)) between 1 and 20),
  name text not null check (char_length(trim(name)) between 2 and 100),
  asset_class public.asset_class not null,
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  latest_price numeric(19, 6) check (latest_price is null or latest_price >= 0),
  price_observed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, institution_id, symbol)
);

create table public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.portfolio_instruments(id),
  transaction_type public.portfolio_transaction_type not null,
  trade_date date not null,
  quantity numeric(24, 8) not null default 0,
  unit_price numeric(19, 6) not null default 0,
  fees numeric(19, 2) not null default 0,
  cash_amount numeric(19, 2) not null default 0,
  created_at timestamptz not null default now(),
  check (unit_price >= 0 and fees >= 0 and cash_amount >= 0),
  check (
    (transaction_type in ('compra', 'venda', 'aporte', 'resgate') and quantity > 0 and unit_price > 0)
    or (transaction_type in ('rendimento', 'taxa') and quantity = 0 and cash_amount > 0)
    or (transaction_type = 'ajuste' and quantity <> 0)
  )
);

create index portfolio_institutions_user_id_idx
  on public.portfolio_institutions(user_id);
create index portfolio_instruments_user_id_idx
  on public.portfolio_instruments(user_id);
create index portfolio_transactions_instrument_date_idx
  on public.portfolio_transactions(instrument_id, trade_date, created_at);

alter table public.portfolio_institutions enable row level security;
alter table public.portfolio_instruments enable row level security;
alter table public.portfolio_transactions enable row level security;

create policy "portfolio institutions are private"
  on public.portfolio_institutions for select
  to authenticated
  using (user_id = auth.uid());

create policy "portfolio instruments are private"
  on public.portfolio_instruments for select
  to authenticated
  using (user_id = auth.uid());

create policy "portfolio transactions are private"
  on public.portfolio_transactions for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.portfolio_institutions from public, anon, authenticated;
revoke all on public.portfolio_instruments from public, anon, authenticated;
revoke all on public.portfolio_transactions from public, anon, authenticated;
grant select on public.portfolio_institutions to authenticated;
grant select on public.portfolio_instruments to authenticated;
grant select on public.portfolio_transactions to authenticated;

create or replace function public.create_portfolio_asset(
  p_institution_name text,
  p_symbol text,
  p_name text,
  p_asset_class public.asset_class,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric,
  p_trade_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  institution_id_value uuid;
  instrument_id_value uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if char_length(trim(p_institution_name)) not between 2 and 80
    or char_length(trim(p_symbol)) not between 1 and 20
    or char_length(trim(p_name)) not between 2 and 100
    or p_quantity <= 0
    or p_unit_price <= 0
    or p_fees < 0
    or p_trade_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception using errcode = '22023', message = 'invalid portfolio asset';
  end if;

  select id into institution_id_value
  from public.portfolio_institutions
  where user_id = user_id_value
    and lower(name) = lower(trim(p_institution_name))
  limit 1;

  if institution_id_value is null then
    insert into public.portfolio_institutions (user_id, name)
    values (user_id_value, trim(p_institution_name))
    returning id into institution_id_value;
  end if;

  insert into public.portfolio_instruments (
    user_id,
    institution_id,
    symbol,
    name,
    asset_class,
    latest_price,
    price_observed_at
  )
  values (
    user_id_value,
    institution_id_value,
    upper(trim(p_symbol)),
    trim(p_name),
    p_asset_class,
    p_unit_price,
    p_trade_date::timestamp at time zone 'America/Sao_Paulo'
  )
  returning id into instrument_id_value;

  insert into public.portfolio_transactions (
    user_id,
    instrument_id,
    transaction_type,
    trade_date,
    quantity,
    unit_price,
    fees
  )
  values (
    user_id_value,
    instrument_id_value,
    'compra',
    p_trade_date,
    p_quantity,
    p_unit_price,
    p_fees
  );

  return instrument_id_value;
end;
$$;

create or replace function public.record_portfolio_transaction(
  p_instrument_id uuid,
  p_transaction_type public.portfolio_transaction_type,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric,
  p_cash_amount numeric,
  p_trade_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  current_quantity numeric;
  transaction_id_value uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1 from public.portfolio_instruments
    where id = p_instrument_id and user_id = user_id_value
  ) then
    raise exception using errcode = '42501', message = 'instrument not available';
  end if;

  select coalesce(sum(
    case
      when transaction_type in ('compra', 'aporte') then quantity
      when transaction_type in ('venda', 'resgate') then -quantity
      when transaction_type = 'ajuste' then quantity
      else 0
    end
  ), 0)
  into current_quantity
  from public.portfolio_transactions
  where instrument_id = p_instrument_id
    and user_id = user_id_value;

  if p_trade_date > (now() at time zone 'America/Sao_Paulo')::date
    or p_unit_price < 0
    or p_fees < 0
    or p_cash_amount < 0
    or (
      p_transaction_type in ('compra', 'venda', 'aporte', 'resgate')
      and (p_quantity <= 0 or p_unit_price <= 0)
    )
    or (
      p_transaction_type in ('rendimento', 'taxa')
      and (p_quantity <> 0 or p_cash_amount <= 0)
    )
    or (p_transaction_type = 'ajuste' and p_quantity = 0) then
    raise exception using errcode = '22023', message = 'invalid transaction';
  end if;

  if p_transaction_type in ('venda', 'resgate') and p_quantity > current_quantity then
    raise exception using errcode = '22003', message = 'insufficient position';
  end if;

  if p_transaction_type = 'ajuste' and current_quantity + p_quantity < 0 then
    raise exception using errcode = '22003', message = 'insufficient position';
  end if;

  insert into public.portfolio_transactions (
    user_id,
    instrument_id,
    transaction_type,
    trade_date,
    quantity,
    unit_price,
    fees,
    cash_amount
  )
  values (
    user_id_value,
    p_instrument_id,
    p_transaction_type,
    p_trade_date,
    p_quantity,
    p_unit_price,
    p_fees,
    p_cash_amount
  )
  returning id into transaction_id_value;

  if p_unit_price > 0 then
    update public.portfolio_instruments
    set latest_price = p_unit_price,
        price_observed_at = p_trade_date::timestamp at time zone 'America/Sao_Paulo'
    where id = p_instrument_id and user_id = user_id_value;
  end if;

  return transaction_id_value;
end;
$$;

revoke all on function public.create_portfolio_asset(text, text, text, public.asset_class, numeric, numeric, numeric, date)
  from public, anon, authenticated;
grant execute on function public.create_portfolio_asset(text, text, text, public.asset_class, numeric, numeric, numeric, date)
  to authenticated;

revoke all on function public.record_portfolio_transaction(uuid, public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date)
  from public, anon, authenticated;
grant execute on function public.record_portfolio_transaction(uuid, public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date)
  to authenticated;

commit;
