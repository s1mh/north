begin;

alter table public.portfolio_transactions
  add column reverses_transaction_id uuid unique references public.portfolio_transactions(id),
  add column corrects_transaction_id uuid unique references public.portfolio_transactions(id),
  add column audit_reason text,
  add constraint portfolio_transaction_audit_shape check (
    not (reverses_transaction_id is not null and corrects_transaction_id is not null)
    and (
      (reverses_transaction_id is null and corrects_transaction_id is null and audit_reason is null)
      or (
        (reverses_transaction_id is not null or corrects_transaction_id is not null)
        and char_length(trim(audit_reason)) between 3 and 200
      )
    )
  );

create or replace function public.portfolio_transaction_input_valid(
  p_transaction_type public.portfolio_transaction_type,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric,
  p_cash_amount numeric,
  p_trade_date date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    p_transaction_type is not null
    and p_quantity is not null
    and p_unit_price is not null
    and p_fees is not null
    and p_cash_amount is not null
    and p_trade_date is not null
    and p_trade_date <= (now() at time zone 'America/Sao_Paulo')::date
    and p_unit_price >= 0
    and p_fees >= 0
    and p_cash_amount >= 0
    and (
      (
        p_transaction_type in ('compra', 'venda', 'aporte', 'resgate')
        and p_quantity > 0
        and p_unit_price > 0
        and p_cash_amount = 0
      )
      or (
        p_transaction_type in ('rendimento', 'taxa')
        and p_quantity = 0
        and p_unit_price = 0
        and p_cash_amount > 0
      )
      or (p_transaction_type = 'ajuste' and p_quantity <> 0)
    );
$$;

create or replace function public.portfolio_timeline_valid(
  p_instrument_id uuid,
  p_user_id uuid,
  p_excluded_transaction_id uuid,
  p_new_transaction_type public.portfolio_transaction_type,
  p_new_quantity numeric,
  p_new_trade_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with effective as (
    select
      transaction.trade_date,
      0 as sort_order,
      transaction.created_at,
      transaction.id,
      case
        when transaction.transaction_type in ('compra', 'aporte') then transaction.quantity
        when transaction.transaction_type in ('venda', 'resgate') then -transaction.quantity
        when transaction.transaction_type = 'ajuste' then transaction.quantity
        else 0
      end as quantity_delta
    from public.portfolio_transactions transaction
    where transaction.instrument_id = p_instrument_id
      and transaction.user_id = p_user_id
      and transaction.id is distinct from p_excluded_transaction_id
      and transaction.reverses_transaction_id is null
      and not exists (
        select 1
        from public.portfolio_transactions reversal
        where reversal.reverses_transaction_id = transaction.id
      )

    union all

    select
      p_new_trade_date,
      1,
      now(),
      gen_random_uuid(),
      case
        when p_new_transaction_type in ('compra', 'aporte') then p_new_quantity
        when p_new_transaction_type in ('venda', 'resgate') then -p_new_quantity
        when p_new_transaction_type = 'ajuste' then p_new_quantity
        else 0
      end
    where p_new_transaction_type is not null
  ),
  running as (
    select sum(quantity_delta) over (
      order by trade_date, sort_order, created_at, id
      rows between unbounded preceding and current row
    ) as quantity
    from effective
  )
  select coalesce(min(quantity) >= 0, true) from running;
$$;

create or replace function public.refresh_portfolio_manual_price(
  p_instrument_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  price_value numeric;
  observed_value timestamptz;
begin
  select
    transaction.unit_price,
    transaction.trade_date::timestamp at time zone 'America/Sao_Paulo'
  into price_value, observed_value
  from public.portfolio_transactions transaction
  where transaction.instrument_id = p_instrument_id
    and transaction.user_id = p_user_id
    and transaction.unit_price > 0
    and transaction.reverses_transaction_id is null
    and not exists (
      select 1
      from public.portfolio_transactions reversal
      where reversal.reverses_transaction_id = transaction.id
    )
  order by transaction.trade_date desc, transaction.created_at desc, transaction.id desc
  limit 1;

  update public.portfolio_instruments
  set latest_price = price_value,
      price_observed_at = observed_value
  where id = p_instrument_id and user_id = p_user_id;
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

  if not public.portfolio_transaction_input_valid(
    p_transaction_type, p_quantity, p_unit_price, p_fees, p_cash_amount, p_trade_date
  ) then
    raise exception using errcode = '22023', message = 'invalid transaction';
  end if;

  if not public.portfolio_timeline_valid(
    p_instrument_id, user_id_value, null, p_transaction_type, p_quantity, p_trade_date
  ) then
    raise exception using errcode = '22003', message = 'insufficient position';
  end if;

  insert into public.portfolio_transactions (
    user_id, instrument_id, transaction_type, trade_date,
    quantity, unit_price, fees, cash_amount
  )
  values (
    user_id_value, p_instrument_id, p_transaction_type, p_trade_date,
    p_quantity, p_unit_price, p_fees, p_cash_amount
  )
  returning id into transaction_id_value;

  perform public.refresh_portfolio_manual_price(p_instrument_id, user_id_value);
  return transaction_id_value;
end;
$$;

create or replace function public.reverse_portfolio_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  original public.portfolio_transactions%rowtype;
  reversal_id_value uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into original
  from public.portfolio_transactions
  where id = p_transaction_id and user_id = user_id_value;

  if original.id is null
    or original.reverses_transaction_id is not null
    or exists (
      select 1 from public.portfolio_transactions
      where reverses_transaction_id = original.id
    ) then
    raise exception using errcode = '42501', message = 'transaction not available';
  end if;

  if char_length(trim(p_reason)) not between 3 and 200 then
    raise exception using errcode = '22023', message = 'invalid reason';
  end if;

  if not public.portfolio_timeline_valid(
    original.instrument_id, user_id_value, original.id, null, null, null
  ) then
    raise exception using errcode = '22003', message = 'dependent transactions';
  end if;

  insert into public.portfolio_transactions (
    user_id, instrument_id, transaction_type, trade_date,
    quantity, unit_price, fees, cash_amount,
    reverses_transaction_id, audit_reason
  )
  values (
    user_id_value, original.instrument_id, original.transaction_type,
    (now() at time zone 'America/Sao_Paulo')::date,
    original.quantity, original.unit_price, original.fees, original.cash_amount,
    original.id, trim(p_reason)
  )
  returning id into reversal_id_value;

  perform public.refresh_portfolio_manual_price(original.instrument_id, user_id_value);
  return reversal_id_value;
end;
$$;

create or replace function public.correct_portfolio_transaction(
  p_transaction_id uuid,
  p_transaction_type public.portfolio_transaction_type,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric,
  p_cash_amount numeric,
  p_trade_date date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  original public.portfolio_transactions%rowtype;
  corrected_id_value uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into original
  from public.portfolio_transactions
  where id = p_transaction_id and user_id = user_id_value;

  if original.id is null
    or original.reverses_transaction_id is not null
    or exists (
      select 1 from public.portfolio_transactions
      where reverses_transaction_id = original.id
    ) then
    raise exception using errcode = '42501', message = 'transaction not available';
  end if;

  if char_length(trim(p_reason)) not between 3 and 200
    or not public.portfolio_transaction_input_valid(
      p_transaction_type, p_quantity, p_unit_price, p_fees, p_cash_amount, p_trade_date
    ) then
    raise exception using errcode = '22023', message = 'invalid correction';
  end if;

  if not public.portfolio_timeline_valid(
    original.instrument_id, user_id_value, original.id,
    p_transaction_type, p_quantity, p_trade_date
  ) then
    raise exception using errcode = '22003', message = 'insufficient position';
  end if;

  insert into public.portfolio_transactions (
    user_id, instrument_id, transaction_type, trade_date,
    quantity, unit_price, fees, cash_amount,
    reverses_transaction_id, audit_reason
  )
  values (
    user_id_value, original.instrument_id, original.transaction_type,
    (now() at time zone 'America/Sao_Paulo')::date,
    original.quantity, original.unit_price, original.fees, original.cash_amount,
    original.id, trim(p_reason)
  );

  insert into public.portfolio_transactions (
    user_id, instrument_id, transaction_type, trade_date,
    quantity, unit_price, fees, cash_amount,
    corrects_transaction_id, audit_reason
  )
  values (
    user_id_value, original.instrument_id, p_transaction_type, p_trade_date,
    p_quantity, p_unit_price, p_fees, p_cash_amount,
    original.id, trim(p_reason)
  )
  returning id into corrected_id_value;

  perform public.refresh_portfolio_manual_price(original.instrument_id, user_id_value);
  return corrected_id_value;
end;
$$;

revoke all on function public.portfolio_transaction_input_valid(public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date)
  from public, anon, authenticated;
revoke all on function public.portfolio_timeline_valid(uuid, uuid, uuid, public.portfolio_transaction_type, numeric, date)
  from public, anon, authenticated;
revoke all on function public.refresh_portfolio_manual_price(uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.reverse_portfolio_transaction(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reverse_portfolio_transaction(uuid, text)
  to authenticated;

revoke all on function public.correct_portfolio_transaction(uuid, public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date, text)
  from public, anon, authenticated;
grant execute on function public.correct_portfolio_transaction(uuid, public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date, text)
  to authenticated;

commit;
