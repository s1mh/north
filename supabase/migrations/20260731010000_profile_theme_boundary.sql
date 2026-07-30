begin;

revoke update on public.profiles from authenticated;
revoke update (display_name, locale, theme) on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

create or replace function public.set_theme_preference(
  p_theme public.theme_preference
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

  update public.profiles
  set theme = p_theme,
      updated_at = now()
  where id = user_id_value
    and deleted_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'profile not available';
  end if;
end;
$$;

revoke all on function public.set_theme_preference(public.theme_preference)
  from public, anon, authenticated;
grant execute on function public.set_theme_preference(public.theme_preference)
  to authenticated;

commit;
