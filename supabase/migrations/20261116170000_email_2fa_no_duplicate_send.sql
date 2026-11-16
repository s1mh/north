begin;

-- Não manda um código novo se já existe um válido enviado há menos de 60 segundos
-- (recarregar a tela de verificação não deve invalidar o código que está no e-mail).
create or replace function public.email_2fa_issue(
  p_user_id uuid, p_session_id uuid, p_purpose text, p_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_id uuid := gen_random_uuid();
begin
  delete from public.email_2fa_challenges where created_at < now() - interval '1 day';
  delete from public.email_2fa_sessions where verified_at < now() - interval '60 days';

  if exists (
    select 1 from public.email_2fa_challenges
    where user_id = p_user_id and session_id = p_session_id and purpose = p_purpose
      and consumed_at is null and expires_at > now()
      and created_at > now() - interval '60 seconds'
  ) then
    return null;
  end if;

  if (
    select count(*) from public.email_2fa_challenges
    where user_id = p_user_id and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'too_many_requests';
  end if;
  update public.email_2fa_challenges set consumed_at = now()
  where user_id = p_user_id and consumed_at is null;
  insert into public.email_2fa_challenges (id, user_id, session_id, purpose, code_hash, expires_at)
  values (
    challenge_id, p_user_id, p_session_id, p_purpose,
    encode(extensions.digest(p_code || ':' || challenge_id::text, 'sha256'), 'hex'),
    now() + interval '10 minutes'
  );
  return challenge_id;
end;
$$;

revoke all on function public.email_2fa_issue(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.email_2fa_issue(uuid, uuid, text, text) to service_role;

commit;
