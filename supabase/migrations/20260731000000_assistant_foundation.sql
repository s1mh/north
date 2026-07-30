begin;

create type public.assistant_message_role as enum ('user', 'assistant');

create table public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.assistant_message_role not null,
  content text not null check (char_length(content) between 1 and 2000),
  structured_payload jsonb check (
    structured_payload is null or jsonb_typeof(structured_payload) = 'object'
  ),
  created_at timestamptz not null default now()
);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete set null,
  kind text not null default 'chat' check (kind in ('chat', 'insight')),
  status text not null check (status in ('fallback', 'blocked')),
  prompt_version text not null check (char_length(prompt_version) between 3 and 80),
  model text not null check (model in ('deterministic-v1', 'policy-v1')),
  context_hash text not null check (context_hash ~ '^[a-f0-9]{64}$'),
  source_refs jsonb not null check (jsonb_typeof(source_refs) = 'array'),
  input_chars integer not null check (input_chars between 0 and 500),
  created_at timestamptz not null default now()
);

create index assistant_threads_user_updated_idx
  on public.assistant_threads(user_id, updated_at desc);
create index assistant_messages_thread_created_idx
  on public.assistant_messages(thread_id, created_at);
create index ai_generations_user_created_idx
  on public.ai_generations(user_id, created_at desc);

alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.ai_generations enable row level security;

revoke all on public.assistant_threads from anon, authenticated;
revoke all on public.assistant_messages from anon, authenticated;
revoke all on public.ai_generations from anon, authenticated;
grant select on public.assistant_threads to authenticated;
grant select on public.assistant_messages to authenticated;

create policy assistant_threads_select_own
  on public.assistant_threads for select to authenticated
  using ((select auth.uid()) = user_id);
create policy assistant_messages_select_own
  on public.assistant_messages for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_assistant_exchange(
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
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if (
    select count(*)
    from public.ai_generations
    where user_id = user_id_value
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'assistant rate limit';
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
    or p_status not in ('fallback', 'blocked')
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

  select string_agg(value, E'\n\n')
  into assistant_content
  from jsonb_array_elements_text(p_assistant_payload -> 'paragraphs');

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

  insert into public.ai_generations (
    user_id,
    thread_id,
    status,
    prompt_version,
    model,
    context_hash,
    source_refs,
    input_chars
  ) values (
    user_id_value,
    thread_id_value,
    p_status,
    p_prompt_version,
    p_model,
    p_context_hash,
    p_source_refs,
    char_length(trim(p_user_content))
  );

  update public.assistant_threads
  set updated_at = now(),
      expires_at = now() + interval '30 days'
  where id = thread_id_value and user_id = user_id_value;

  return thread_id_value;
end;
$$;

create or replace function public.delete_assistant_thread(p_thread_id uuid)
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

  if not exists (
    select 1 from public.assistant_threads
    where id = p_thread_id and user_id = user_id_value
  ) then
    raise exception using errcode = '42501', message = 'thread not available';
  end if;

  delete from public.assistant_threads
  where id = p_thread_id and user_id = user_id_value;
end;
$$;

revoke all on function public.save_assistant_exchange(
  uuid, text, text, jsonb, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.save_assistant_exchange(
  uuid, text, text, jsonb, text, text, text, text, jsonb
) to authenticated;
revoke all on function public.delete_assistant_thread(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_assistant_thread(uuid)
  to authenticated;

commit;
