begin;

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
  minimum_running_quantity numeric;
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

  if p_trade_date > (now() at time zone 'America/Sao_Paulo')::date
    or p_unit_price < 0
    or p_fees < 0
    or p_cash_amount < 0
    or (
      p_transaction_type in ('compra', 'venda', 'aporte', 'resgate')
      and (p_quantity <= 0 or p_unit_price <= 0 or p_cash_amount <> 0)
    )
    or (
      p_transaction_type in ('rendimento', 'taxa')
      and (p_quantity <> 0 or p_unit_price <> 0 or p_cash_amount <= 0)
    )
    or (p_transaction_type = 'ajuste' and p_quantity = 0) then
    raise exception using errcode = '22023', message = 'invalid transaction';
  end if;

  select min(running_quantity)
  into minimum_running_quantity
  from (
    select sum(quantity_delta) over (
      order by trade_date, sort_order, created_at, id
      rows between unbounded preceding and current row
    ) as running_quantity
    from (
      select
        trade_date,
        0 as sort_order,
        created_at,
        id,
        case
          when transaction_type in ('compra', 'aporte') then quantity
          when transaction_type in ('venda', 'resgate') then -quantity
          when transaction_type = 'ajuste' then quantity
          else 0
        end as quantity_delta
      from public.portfolio_transactions
      where instrument_id = p_instrument_id
        and user_id = user_id_value

      union all

      select
        p_trade_date,
        1,
        now(),
        gen_random_uuid(),
        case
          when p_transaction_type in ('compra', 'aporte') then p_quantity
          when p_transaction_type in ('venda', 'resgate') then -p_quantity
          when p_transaction_type = 'ajuste' then p_quantity
          else 0
        end
    ) timeline
  ) running;

  if minimum_running_quantity < 0 then
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

revoke all on function public.record_portfolio_transaction(uuid, public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date)
  from public, anon, authenticated;
grant execute on function public.record_portfolio_transaction(uuid, public.portfolio_transaction_type, numeric, numeric, numeric, numeric, date)
  to authenticated;

commit;
