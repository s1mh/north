begin;

alter table public.ai_generations
  drop constraint ai_generations_status_check,
  drop constraint ai_generations_model_check;

alter table public.ai_generations
  add constraint ai_generations_status_check
    check (status in ('pending', 'generated', 'fallback', 'blocked')),
  add constraint ai_generations_status_model_check check (
    (status = 'pending' and model = 'pending')
    or (
      status = 'generated'
      and char_length(model) between 3 and 120
      and model ~ '^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*$'
    )
    or (status = 'fallback' and model = 'deterministic-v1')
    or (status = 'blocked' and model = 'policy-v1')
  );

create or replace function public.claim_assistant_generation(
  p_prompt_version text,
  p_context_hash text,
  p_source_refs jsonb,
  p_input_chars integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  generation_id_value uuid;
  source_ref_valid boolean;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select coalesce(bool_and(
    jsonb_typeof(value) = 'string'
    and char_length(value #>> '{}') between 2 and 100
  ), true)
  into source_ref_valid
  from jsonb_array_elements(coalesce(p_source_refs, '[]'::jsonb));

  if p_prompt_version <> 'north-educational-2026-07-30'
    or p_context_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_source_refs) is distinct from 'array'
    or jsonb_array_length(p_source_refs) > 10
    or source_ref_valid is not true
    or p_input_chars not between 2 and 500
  then
    raise exception using errcode = '22023', message = 'invalid assistant claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(user_id_value::text, 0));

  if (
    select count(*)
    from public.ai_generations
    where user_id = user_id_value
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'assistant rate limit';
  end if;

  insert into public.ai_generations (
    user_id,
    status,
    prompt_version,
    model,
    context_hash,
    source_refs,
    input_chars
  ) values (
    user_id_value,
    'pending',
    p_prompt_version,
    'pending',
    p_context_hash,
    p_source_refs,
    p_input_chars
  )
  returning id into generation_id_value;

  return generation_id_value;
end;
$$;

create or replace function public.save_claimed_assistant_exchange(
  p_generation_id uuid,
  p_thread_id uuid,
  p_title text,
  p_user_content text,
  p_assistant_payload jsonb,
  p_status text,
  p_model text,
  p_prompt_version text,
  p_context_hash text,
  p_source_refs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  thread_id_value uuid := p_thread_id;
  assistant_content text;
  source_ref_valid boolean;
  claimed_generation_id uuid;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select coalesce(bool_and(
    jsonb_typeof(value) = 'string'
    and char_length(value #>> '{}') between 2 and 100
  ), true)
  into source_ref_valid
  from jsonb_array_elements(coalesce(p_source_refs, '[]'::jsonb));

  if char_length(trim(p_title)) not between 2 and 80
    or char_length(trim(p_user_content)) not between 2 and 500
    or jsonb_typeof(p_assistant_payload) is distinct from 'object'
    or jsonb_typeof(p_assistant_payload -> 'paragraphs') is distinct from 'array'
    or jsonb_array_length(p_assistant_payload -> 'paragraphs') not between 1 and 3
    or jsonb_typeof(p_assistant_payload -> 'facts') is distinct from 'array'
    or jsonb_array_length(p_assistant_payload -> 'facts') > 6
    or jsonb_typeof(p_assistant_payload -> 'actions') is distinct from 'array'
    or jsonb_array_length(p_assistant_payload -> 'actions') > 2
    or p_assistant_payload ->> 'disclaimer'
      is distinct from 'Conteúdo educacional baseado apenas nos dados cadastrados no North. Não é recomendação de investimento nem garantia de resultado.'
    or coalesce(char_length(p_assistant_payload ->> 'title'), 0) not between 2 and 180
    or p_status not in ('generated', 'fallback', 'blocked')
    or (p_status = 'generated' and (
      char_length(p_model) not between 3 and 120
      or p_model !~ '^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*$'
    ))
    or (p_status = 'fallback' and p_model <> 'deterministic-v1')
    or (p_status = 'blocked' and p_model <> 'policy-v1')
    or p_prompt_version <> 'north-educational-2026-07-30'
    or p_context_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_source_refs) is distinct from 'array'
    or jsonb_array_length(p_source_refs) > 10
    or source_ref_valid is not true
  then
    raise exception using errcode = '22023', message = 'invalid assistant exchange';
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

  select string_agg(value, E'\n\n')
  into assistant_content
  from jsonb_array_elements_text(p_assistant_payload -> 'paragraphs');

  update public.ai_generations
  set thread_id = thread_id_value,
      status = p_status,
      model = p_model
  where id = p_generation_id
    and user_id = user_id_value
    and status = 'pending'
    and prompt_version = p_prompt_version
    and context_hash = p_context_hash
    and source_refs = p_source_refs
    and input_chars = char_length(trim(p_user_content))
  returning id into claimed_generation_id;

  if claimed_generation_id is null then
    raise exception using errcode = '42501', message = 'generation claim not available';
  end if;

  insert into public.assistant_messages (
    thread_id, user_id, role, content
  ) values (
    thread_id_value, user_id_value, 'user', trim(p_user_content)
  );

  insert into public.assistant_messages (
    thread_id, user_id, role, content, structured_payload
  ) values (
    thread_id_value,
    user_id_value,
    'assistant',
    assistant_content,
    p_assistant_payload
  );

  update public.assistant_threads
  set updated_at = now(),
      expires_at = now() + interval '30 days'
  where id = thread_id_value and user_id = user_id_value;

  return thread_id_value;
end;
$$;

revoke all on function public.claim_assistant_generation(text, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.claim_assistant_generation(text, text, jsonb, integer)
  to authenticated;

revoke all on function public.save_claimed_assistant_exchange(
  uuid, uuid, text, text, jsonb, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.save_claimed_assistant_exchange(
  uuid, uuid, text, text, jsonb, text, text, text, text, jsonb
) to authenticated;

comment on function public.claim_assistant_generation(text, text, jsonb, integer)
  is 'Reserves one authenticated assistant interaction before any paid provider call.';
comment on function public.save_claimed_assistant_exchange(
  uuid, uuid, text, text, jsonb, text, text, text, text, jsonb
) is 'Atomically persists an assistant exchange and finalizes its reserved generation audit.';

commit;
