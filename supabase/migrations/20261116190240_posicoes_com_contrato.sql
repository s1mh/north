begin;

-- Fase 5a: ficha do contrato e valor atual informado por quem investe.

create table public.portfolio_instrument_terms (
  instrument_id uuid primary key references public.portfolio_instruments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_type text check (product_type in (
    'rdb', 'cdb', 'lci', 'lca', 'lc', 'conta_remunerada', 'poupanca', 'tesouro',
    'fundo', 'previdencia', 'debenture', 'cri', 'cra', 'outro'
  )),
  issuer text check (issuer is null or char_length(trim(issuer)) between 2 and 80),
  indexer text check (indexer in ('cdi_pct', 'selic_pct', 'ipca_mais', 'pre', 'poupanca', 'nenhum')),
  rate numeric(9, 4) check (rate is null or rate between 0 and 1000),
  start_date date,
  maturity_date date,
  liquidity text check (liquidity in ('diaria', 'no_vencimento', 'd_mais_n')),
  liquidity_days integer check (liquidity_days is null or liquidity_days between 0 and 365),
  fgc text check (fgc in ('sim', 'nao', 'nao_se_aplica')),
  tax_regime text check (tax_regime in (
    'regressivo', 'isento', 'previdencia_regressiva', 'previdencia_progressiva', 'nao_sei'
  )),
  updated_at timestamptz not null default now(),
  check (start_date is null or maturity_date is null or maturity_date >= start_date),
  check (liquidity = 'd_mais_n' or liquidity_days is null)
);

create table public.portfolio_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.portfolio_instruments(id) on delete cascade,
  valued_on date not null,
  total_value numeric(19, 2) not null check (total_value > 0),
  quantity numeric(24, 8) not null check (quantity > 0),
  unit_price numeric(19, 6) not null check (unit_price > 0),
  source text not null check (source in ('informado', 'estimado', 'mercado')),
  created_at timestamptz not null default now(),
  unique (instrument_id, valued_on, source)
);
create index portfolio_valuations_instrument_idx on public.portfolio_valuations(instrument_id, valued_on desc);
create index portfolio_valuations_user_idx on public.portfolio_valuations(user_id);
create index portfolio_instrument_terms_user_idx on public.portfolio_instrument_terms(user_id);

alter table public.portfolio_instrument_terms enable row level security;
alter table public.portfolio_valuations enable row level security;
revoke all on public.portfolio_instrument_terms from anon, authenticated;
revoke all on public.portfolio_valuations from anon, authenticated;
grant select on public.portfolio_instrument_terms to authenticated;
grant select on public.portfolio_valuations to authenticated;
create policy portfolio_instrument_terms_select_own
  on public.portfolio_instrument_terms for select to authenticated
  using ((select auth.uid()) = user_id);
create policy portfolio_valuations_select_own
  on public.portfolio_valuations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mfa_required on public.portfolio_instrument_terms
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
create policy mfa_required on public.portfolio_valuations
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Quantidade atual de um ativo (mesma regra do livro: ignora estornos e lançamentos estornados).
create or replace function public.instrument_quantity(p_instrument_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case t.transaction_type
      when 'compra' then t.quantity
      when 'aporte' then t.quantity
      when 'venda' then -t.quantity
      when 'resgate' then -t.quantity
      when 'ajuste' then t.quantity
      else 0
    end
  ), 0)
  from public.portfolio_transactions t
  where t.instrument_id = p_instrument_id
    and t.user_id = auth.uid()
    and t.reverses_transaction_id is null
    and not exists (
      select 1 from public.portfolio_transactions r
      where r.reverses_transaction_id = t.id
    );
$$;

-- Informa o valor total de hoje; o app guarda o preço implícito (total / quantidade) e a série.
create or replace function public.record_instrument_valuation(
  p_instrument_id uuid,
  p_total_value numeric,
  p_valued_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  today_value date := (now() at time zone 'America/Sao_Paulo')::date;
  instrument public.portfolio_instruments%rowtype;
  quantity_value numeric;
  price_value numeric;
  first_trade date;
  previous_price numeric;
  previous_observed timestamptz;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();

  select * into instrument from public.portfolio_instruments
  where id = p_instrument_id and user_id = user_id_value;
  if instrument.id is null then
    raise exception using errcode = '42501', message = 'instrument not available';
  end if;

  if p_total_value is null or p_total_value <= 0 or p_total_value > 999999999999
    or p_valued_on is null or p_valued_on > today_value
  then
    raise exception using errcode = '22023', message = 'invalid valuation';
  end if;

  select min(trade_date) into first_trade from public.portfolio_transactions
  where instrument_id = p_instrument_id;
  if first_trade is null or p_valued_on < first_trade then
    raise exception using errcode = '22023', message = 'valuation before first trade';
  end if;

  quantity_value := public.instrument_quantity(p_instrument_id);
  if quantity_value <= 0 then
    raise exception using errcode = '22003', message = 'no position to value';
  end if;
  price_value := round(p_total_value / quantity_value, 6);
  if price_value <= 0 then
    raise exception using errcode = '22023', message = 'invalid valuation';
  end if;

  previous_price := instrument.latest_price;
  previous_observed := instrument.price_observed_at;

  insert into public.portfolio_valuations (user_id, instrument_id, valued_on, total_value, quantity, unit_price, source)
  values (user_id_value, p_instrument_id, p_valued_on, round(p_total_value, 2), quantity_value, price_value, 'informado')
  on conflict (instrument_id, valued_on, source) do update
    set total_value = excluded.total_value, quantity = excluded.quantity,
        unit_price = excluded.unit_price, created_at = now();

  -- Só atualiza o preço atual se esta marcação não for mais antiga que a que já vale.
  if instrument.price_observed_at is null
    or (instrument.price_observed_at at time zone 'America/Sao_Paulo')::date <= p_valued_on
  then
    update public.portfolio_instruments
    set latest_price = price_value,
        price_observed_at = (p_valued_on::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo'
    where id = p_instrument_id;
  end if;

  return jsonb_build_object(
    'unit_price', price_value,
    'quantity', quantity_value,
    'valued_on', p_valued_on,
    'previous_price', previous_price,
    'previous_observed_at', previous_observed
  );
end;
$$;

-- Desfaz uma marcação informada (usado pelo "Desfazer" do assistente).
create or replace function public.restore_instrument_valuation(
  p_instrument_id uuid,
  p_valued_on date,
  p_previous_price numeric,
  p_previous_observed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  if not exists (
    select 1 from public.portfolio_instruments where id = p_instrument_id and user_id = user_id_value
  ) then
    raise exception using errcode = '42501', message = 'instrument not available';
  end if;
  delete from public.portfolio_valuations
  where instrument_id = p_instrument_id and user_id = user_id_value
    and valued_on = p_valued_on and source = 'informado';
  update public.portfolio_instruments
  set latest_price = p_previous_price, price_observed_at = p_previous_observed_at
  where id = p_instrument_id and user_id = user_id_value;
end;
$$;

-- Ficha do contrato: campos ausentes mantêm o valor; JSON null limpa o campo.
create or replace function public.set_instrument_terms(p_instrument_id uuid, p_terms jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  existing public.portfolio_instrument_terms%rowtype;
  previous jsonb;
  allowed_keys text[] := array[
    'product_type', 'issuer', 'indexer', 'rate', 'start_date', 'maturity_date',
    'liquidity', 'liquidity_days', 'fgc', 'tax_regime'
  ];
  key_value text;
  merged public.portfolio_instrument_terms%rowtype;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  if jsonb_typeof(p_terms) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid terms';
  end if;
  for key_value in select jsonb_object_keys(p_terms) loop
    if not (key_value = any(allowed_keys)) then
      raise exception using errcode = '22023', message = 'invalid terms';
    end if;
  end loop;
  if not exists (
    select 1 from public.portfolio_instruments where id = p_instrument_id and user_id = user_id_value
  ) then
    raise exception using errcode = '42501', message = 'instrument not available';
  end if;

  select * into existing from public.portfolio_instrument_terms where instrument_id = p_instrument_id;
  previous := case when existing.instrument_id is null then null else to_jsonb(existing) end;

  merged.instrument_id := p_instrument_id;
  merged.user_id := user_id_value;
  merged.product_type := case when p_terms ? 'product_type' then p_terms ->> 'product_type' else existing.product_type end;
  merged.issuer := case when p_terms ? 'issuer' then nullif(trim(p_terms ->> 'issuer'), '') else existing.issuer end;
  merged.indexer := case when p_terms ? 'indexer' then p_terms ->> 'indexer' else existing.indexer end;
  merged.rate := case when p_terms ? 'rate' then (p_terms ->> 'rate')::numeric else existing.rate end;
  merged.start_date := case when p_terms ? 'start_date' then (p_terms ->> 'start_date')::date else existing.start_date end;
  merged.maturity_date := case when p_terms ? 'maturity_date' then (p_terms ->> 'maturity_date')::date else existing.maturity_date end;
  merged.liquidity := case when p_terms ? 'liquidity' then p_terms ->> 'liquidity' else existing.liquidity end;
  merged.liquidity_days := case when p_terms ? 'liquidity_days' then (p_terms ->> 'liquidity_days')::integer else existing.liquidity_days end;
  merged.fgc := case when p_terms ? 'fgc' then p_terms ->> 'fgc' else existing.fgc end;
  merged.tax_regime := case when p_terms ? 'tax_regime' then p_terms ->> 'tax_regime' else existing.tax_regime end;

  insert into public.portfolio_instrument_terms (
    instrument_id, user_id, product_type, issuer, indexer, rate, start_date, maturity_date,
    liquidity, liquidity_days, fgc, tax_regime, updated_at
  ) values (
    merged.instrument_id, merged.user_id, merged.product_type, merged.issuer, merged.indexer, merged.rate,
    merged.start_date, merged.maturity_date, merged.liquidity, merged.liquidity_days, merged.fgc,
    merged.tax_regime, now()
  )
  on conflict (instrument_id) do update set
    product_type = excluded.product_type, issuer = excluded.issuer, indexer = excluded.indexer,
    rate = excluded.rate, start_date = excluded.start_date, maturity_date = excluded.maturity_date,
    liquidity = excluded.liquidity, liquidity_days = excluded.liquidity_days, fgc = excluded.fgc,
    tax_regime = excluded.tax_regime, updated_at = now();

  return jsonb_build_object(
    'previous', previous,
    'current', (select to_jsonb(t) from public.portfolio_instrument_terms t where t.instrument_id = p_instrument_id)
  );
end;
$$;

-- Restaura a ficha anterior (ou remove, se não havia ficha).
create or replace function public.restore_instrument_terms(p_instrument_id uuid, p_previous jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  if not exists (
    select 1 from public.portfolio_instruments where id = p_instrument_id and user_id = user_id_value
  ) then
    raise exception using errcode = '42501', message = 'instrument not available';
  end if;
  if p_previous is null or jsonb_typeof(p_previous) = 'null' then
    delete from public.portfolio_instrument_terms where instrument_id = p_instrument_id and user_id = user_id_value;
    return;
  end if;
  insert into public.portfolio_instrument_terms (
    instrument_id, user_id, product_type, issuer, indexer, rate, start_date, maturity_date,
    liquidity, liquidity_days, fgc, tax_regime, updated_at
  ) values (
    p_instrument_id, user_id_value, p_previous ->> 'product_type', p_previous ->> 'issuer',
    p_previous ->> 'indexer', (p_previous ->> 'rate')::numeric, (p_previous ->> 'start_date')::date,
    (p_previous ->> 'maturity_date')::date, p_previous ->> 'liquidity',
    (p_previous ->> 'liquidity_days')::integer, p_previous ->> 'fgc', p_previous ->> 'tax_regime', now()
  )
  on conflict (instrument_id) do update set
    product_type = excluded.product_type, issuer = excluded.issuer, indexer = excluded.indexer,
    rate = excluded.rate, start_date = excluded.start_date, maturity_date = excluded.maturity_date,
    liquidity = excluded.liquidity, liquidity_days = excluded.liquidity_days, fgc = excluded.fgc,
    tax_regime = excluded.tax_regime, updated_at = now();
end;
$$;

revoke all on function public.instrument_quantity(uuid) from public, anon;
revoke all on function public.record_instrument_valuation(uuid, numeric, date) from public, anon;
revoke all on function public.restore_instrument_valuation(uuid, date, numeric, timestamptz) from public, anon;
revoke all on function public.set_instrument_terms(uuid, jsonb) from public, anon;
revoke all on function public.restore_instrument_terms(uuid, jsonb) from public, anon;
grant execute on function public.instrument_quantity(uuid) to authenticated;
grant execute on function public.record_instrument_valuation(uuid, numeric, date) to authenticated;
grant execute on function public.restore_instrument_valuation(uuid, date, numeric, timestamptz) to authenticated;
grant execute on function public.set_instrument_terms(uuid, jsonb) to authenticated;
grant execute on function public.restore_instrument_terms(uuid, jsonb) to authenticated;

-- Ações do assistente: novos tipos.
alter table public.assistant_actions drop constraint assistant_actions_kind_check;
alter table public.assistant_actions add constraint assistant_actions_kind_check check (
  kind in (
    'record_transaction', 'create_asset', 'goal_contribution', 'reverse_transaction', 'create_goal',
    'update_valuation', 'set_terms'
  )
);

create or replace function public.create_assistant_action(p_kind text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  action_id_value uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  if p_kind not in (
      'record_transaction', 'create_asset', 'goal_contribution', 'reverse_transaction', 'create_goal',
      'update_valuation', 'set_terms'
    )
    or jsonb_typeof(p_payload) is distinct from 'object'
  then
    raise exception using errcode = '22023', message = 'invalid assistant action';
  end if;
  if (
    select count(*) from public.assistant_actions
    where user_id = user_id_value and created_at >= now() - interval '1 hour'
  ) >= 30 then
    raise exception using errcode = 'P0001', message = 'assistant action limit';
  end if;

  insert into public.assistant_actions (user_id, kind, payload)
  values (user_id_value, p_kind, p_payload)
  returning id into action_id_value;
  return action_id_value;
end;
$$;

-- Exportação de dados (LGPD): inclui ficha, marcações e ações do assistente.
CREATE OR REPLACE FUNCTION public.export_current_user_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  user_id_value uuid := auth.uid();
begin
  perform public.require_mfa();
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return jsonb_build_object(
    'schema_version', '2026-11-16',
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
      'portfolio_instrument_terms', coalesce((
        select jsonb_agg(to_jsonb(terms) order by terms.updated_at, terms.instrument_id)
        from public.portfolio_instrument_terms terms
        where terms.user_id = user_id_value
      ), '[]'::jsonb),
      'portfolio_valuations', coalesce((
        select jsonb_agg(to_jsonb(valuation) order by valuation.valued_on, valuation.created_at, valuation.id)
        from public.portfolio_valuations valuation
        where valuation.user_id = user_id_value
      ), '[]'::jsonb),
      'assistant_actions', coalesce((
        select jsonb_agg(to_jsonb(action) order by action.created_at, action.id)
        from public.assistant_actions action
        where action.user_id = user_id_value
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
$function$;

commit;
