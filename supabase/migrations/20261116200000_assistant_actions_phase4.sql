begin;

-- Fase 4 do assistente: estorno de lançamento e criação de meta por proposta.
alter table public.assistant_actions drop constraint assistant_actions_kind_check;
alter table public.assistant_actions add constraint assistant_actions_kind_check check (
  kind in ('record_transaction', 'create_asset', 'goal_contribution', 'reverse_transaction', 'create_goal')
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
  if p_kind not in ('record_transaction', 'create_asset', 'goal_contribution', 'reverse_transaction', 'create_goal')
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

commit;
