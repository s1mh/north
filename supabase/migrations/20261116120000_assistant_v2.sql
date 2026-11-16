begin;

-- ===== Conversas v2: texto natural + ações propostas pelo assistente =====

-- Ações propostas pela IA. Só o servidor grava, depois do "Confirmar" da pessoa.
create table public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete cascade,
  message_id uuid references public.assistant_messages(id) on delete cascade,
  kind text not null check (kind in ('record_transaction', 'create_asset', 'goal_contribution')),
  status text not null default 'proposed' check (
    status in ('proposed', 'confirming', 'confirmed', 'cancelled', 'failed', 'undoing', 'undone')
  ),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  decided_at timestamptz
);
create index assistant_actions_user_created_idx on public.assistant_actions(user_id, created_at desc);
create index assistant_actions_message_idx on public.assistant_actions(message_id);

alter table public.assistant_actions enable row level security;
revoke all on public.assistant_actions from anon, authenticated;
grant select on public.assistant_actions to authenticated;
create policy assistant_actions_select_own
  on public.assistant_actions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mfa_required on public.assistant_actions
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Reserva uma mensagem (limite de 20 por hora) antes de chamar o provedor pago.
create or replace function public.claim_assistant_turn(p_input_chars integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  generation_id_value uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();
  if p_input_chars not between 2 and 500 then
    raise exception using errcode = '22023', message = 'invalid assistant claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(user_id_value::text, 0));
  if (
    select count(*) from public.ai_generations
    where user_id = user_id_value and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'assistant rate limit';
  end if;

  insert into public.ai_generations (
    user_id, status, prompt_version, model, context_hash, source_refs, input_chars
  ) values (
    user_id_value, 'pending', 'north-assistant-v2', 'pending', repeat('0', 64), '[]'::jsonb, p_input_chars
  ) returning id into generation_id_value;

  return generation_id_value;
end;
$$;

-- Grava a troca (pergunta + resposta), cria a conversa se preciso e liga as ações à mensagem.
create or replace function public.save_assistant_turn(
  p_generation_id uuid,
  p_thread_id uuid,
  p_title text,
  p_user_content text,
  p_assistant_text text,
  p_assistant_payload jsonb,
  p_status text,
  p_model text,
  p_action_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  thread_id_value uuid := p_thread_id;
  claimed_id uuid;
  user_message_id uuid;
  assistant_message_id uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();

  if char_length(trim(p_title)) not between 2 and 80
    or char_length(trim(p_user_content)) not between 2 and 500
    or char_length(trim(p_assistant_text)) not between 1 and 2000
    or jsonb_typeof(p_assistant_payload) is distinct from 'object'
    or p_status not in ('generated', 'fallback', 'blocked')
    or (p_status = 'generated' and (
      char_length(p_model) not between 3 and 120
      or p_model !~ '^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*$'
    ))
    or (p_status = 'fallback' and p_model <> 'deterministic-v1')
    or (p_status = 'blocked' and p_model <> 'policy-v1')
    or coalesce(array_length(p_action_ids, 1), 0) > 5
  then
    raise exception using errcode = '22023', message = 'invalid assistant turn';
  end if;

  if thread_id_value is null then
    insert into public.assistant_threads (user_id, title)
    values (user_id_value, trim(p_title))
    returning id into thread_id_value;
  elsif not exists (
    select 1 from public.assistant_threads
    where id = thread_id_value and user_id = user_id_value
  ) then
    raise exception using errcode = '42501', message = 'thread not available';
  end if;

  update public.ai_generations
  set thread_id = thread_id_value, status = p_status, model = p_model
  where id = p_generation_id and user_id = user_id_value and status = 'pending'
    and prompt_version = 'north-assistant-v2'
  returning id into claimed_id;
  if claimed_id is null then
    raise exception using errcode = '42501', message = 'generation claim not available';
  end if;

  insert into public.assistant_messages (thread_id, user_id, role, content)
  values (thread_id_value, user_id_value, 'user', trim(p_user_content))
  returning id into user_message_id;

  insert into public.assistant_messages (thread_id, user_id, role, content, structured_payload)
  values (thread_id_value, user_id_value, 'assistant', trim(p_assistant_text), p_assistant_payload)
  returning id into assistant_message_id;

  if coalesce(array_length(p_action_ids, 1), 0) > 0 then
    update public.assistant_actions
    set thread_id = thread_id_value, message_id = assistant_message_id
    where id = any(p_action_ids) and user_id = user_id_value and message_id is null;
  end if;

  update public.assistant_threads
  set updated_at = now(), expires_at = now() + interval '30 days'
  where id = thread_id_value and user_id = user_id_value;

  return jsonb_build_object(
    'thread_id', thread_id_value,
    'user_message_id', user_message_id,
    'assistant_message_id', assistant_message_id
  );
end;
$$;

-- A IA propõe; nada é gravado na carteira aqui.
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
  if p_kind not in ('record_transaction', 'create_asset', 'goal_contribution')
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

-- Transição atômica de estado (impede confirmar duas vezes e confirmar proposta vencida).
create or replace function public.transition_assistant_action(
  p_action_id uuid,
  p_from text,
  p_to text,
  p_result jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  row_value public.assistant_actions%rowtype;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform public.require_mfa();

  if (p_from, p_to) not in (
    ('proposed', 'confirming'), ('proposed', 'cancelled'),
    ('confirming', 'confirmed'), ('confirming', 'failed'),
    ('confirmed', 'undoing'), ('undoing', 'undone'), ('undoing', 'confirmed')
  ) or (p_result is not null and jsonb_typeof(p_result) is distinct from 'object') then
    raise exception using errcode = '22023', message = 'invalid transition';
  end if;

  update public.assistant_actions
  set status = p_to,
      result = coalesce(p_result, result),
      decided_at = now()
  where id = p_action_id and user_id = user_id_value and status = p_from
    and (p_from <> 'proposed' or p_to = 'cancelled' or expires_at > now())
  returning * into row_value;

  if row_value.id is null then
    raise exception using errcode = '42501', message = 'action not available';
  end if;

  return jsonb_build_object(
    'id', row_value.id, 'kind', row_value.kind, 'status', row_value.status,
    'payload', row_value.payload, 'result', row_value.result
  );
end;
$$;

revoke all on function public.claim_assistant_turn(integer) from public, anon;
revoke all on function public.save_assistant_turn(uuid, uuid, text, text, text, jsonb, text, text, uuid[]) from public, anon;
revoke all on function public.create_assistant_action(text, jsonb) from public, anon;
revoke all on function public.transition_assistant_action(uuid, text, text, jsonb) from public, anon;
grant execute on function public.claim_assistant_turn(integer) to authenticated;
grant execute on function public.save_assistant_turn(uuid, uuid, text, text, text, jsonb, text, text, uuid[]) to authenticated;
grant execute on function public.create_assistant_action(text, jsonb) to authenticated;
grant execute on function public.transition_assistant_action(uuid, text, text, jsonb) to authenticated;

commit;
