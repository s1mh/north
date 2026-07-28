begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name_value text := trim(new.raw_user_meta_data ->> 'display_name');
  terms_version text := new.raw_user_meta_data ->> 'consent_terms_version';
  privacy_version text := new.raw_user_meta_data ->> 'consent_privacy_version';
begin
  if char_length(display_name_value) not between 2 and 80 then
    raise exception 'invalid display name';
  end if;

  if terms_version <> '2026-07-28' or privacy_version <> '2026-07-28' then
    raise exception 'current consent is required';
  end if;

  insert into public.profiles (id, display_name, onboarding)
  values (new.id, display_name_value, 'consent');

  insert into public.consent_records (user_id, document_type, document_version)
  values
    (new.id, 'terms', terms_version),
    (new.id, 'privacy', privacy_version);

  update public.profiles set onboarding = 'suitability' where id = new.id;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
