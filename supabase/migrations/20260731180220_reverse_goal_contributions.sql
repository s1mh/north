begin;

alter table public.goal_contributions
  add column reversed_at timestamptz,
  add column reversal_reason text
    check (reversal_reason is null or char_length(trim(reversal_reason)) between 3 and 160),
  add constraint goal_contribution_reversal_complete check (
    (reversed_at is null and reversal_reason is null)
    or (reversed_at is not null and reversal_reason is not null)
  );

create or replace function public.reverse_goal_contribution(
  p_contribution_id uuid,
  p_reason text
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

  if p_reason is null or char_length(trim(p_reason)) not between 3 and 160 then
    raise exception using errcode = '22023', message = 'invalid reversal reason';
  end if;

  update public.goal_contributions
  set reversed_at = now(), reversal_reason = trim(p_reason)
  where id = p_contribution_id
    and user_id = user_id_value
    and reversed_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'contribution not available';
  end if;
end;
$$;

revoke all on function public.reverse_goal_contribution(uuid, text)
  from public, anon;
grant execute on function public.reverse_goal_contribution(uuid, text)
  to authenticated;

commit;
