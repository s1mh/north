begin;

revoke insert, update on public.profiles from authenticated;
grant update (display_name, locale, theme) on public.profiles to authenticated;
revoke insert on public.suitability_assessments from authenticated;

create or replace function public.complete_suitability(
  p_answers jsonb,
  p_questionnaire_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := auth.uid();
  points integer;
  score_value smallint;
  profile_value public.investor_profile;
  allocation_value jsonb;
  assessment_id uuid;
  reason_value text;
begin
  if user_id_value is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_questionnaire_version <> '2026-07-28'
    or jsonb_typeof(p_answers) <> 'object'
    or (select count(*) from jsonb_object_keys(p_answers)) <> 12 then
    raise exception using errcode = '22023', message = 'invalid questionnaire';
  end if;

  points :=
    case p_answers ->> 'objetivo' when 'preservar' then 0 when 'equilibrar' then 2 when 'crescer' then 3 end +
    case p_answers ->> 'prazo' when 'ate-2' then 0 when '2-a-5' then 1 when '5-a-10' then 2 when 'mais-10' then 3 end +
    case p_answers ->> 'reserva' when 'nao-tenho' then 0 when 'parcial' then 1 when 'completa' then 3 end +
    case p_answers ->> 'queda' when 'vendo' then 0 when 'espero' then 2 when 'compro' then 3 end +
    case p_answers ->> 'experiencia' when 'comecando' then 0 when 'ate-2' then 1 when '2-a-5' then 2 when 'mais-5' then 3 end +
    case p_answers ->> 'conhecimento' when 'pouco' then 0 when 'basico' then 1 when 'acompanho' then 2 when 'avancado' then 3 end +
    case p_answers ->> 'renda' when 'instavel' then 0 when 'parcial' then 1 when 'estavel' then 3 end +
    case p_answers ->> 'dependencia' when 'provavel' then 0 when 'talvez' then 1 when 'improvavel' then 3 end +
    case p_answers ->> 'oscilacao' when 'ate-5' then 0 when 'ate-10' then 1 when 'ate-20' then 2 when 'mais-20' then 3 end +
    case p_answers ->> 'decisao' when 'saio' then 0 when 'avalio' then 2 when 'oportunidade' then 3 end +
    case p_answers ->> 'diversificacao' when 'ate-10' then 0 when 'ate-30' then 1 when 'ate-50' then 2 when 'mais-50' then 3 end +
    case p_answers ->> 'prioridade' when 'seguranca' then 0 when 'equilibrio' then 2 when 'retorno' then 3 end;

  if points is null then
    raise exception using errcode = '22023', message = 'invalid answers';
  end if;

  score_value := round((points::numeric / 36) * 100)::smallint;
  profile_value := case
    when score_value <= 35 then 'conservador'::public.investor_profile
    when score_value <= 70 then 'moderado'::public.investor_profile
    else 'arrojado'::public.investor_profile
  end;
  allocation_value := case profile_value
    when 'conservador' then '{"Renda Fixa":70,"Fundos":15,"Internacional":10,"Ações · ETF":5}'::jsonb
    when 'moderado' then '{"Renda Fixa":40,"Ações · ETF":25,"FIIs":15,"Internacional":10,"Cripto":10}'::jsonb
    when 'arrojado' then '{"Ações · ETF":40,"Internacional":20,"Renda Fixa":15,"FIIs":15,"Cripto":10}'::jsonb
  end;

  select case when current_assessment_id is null then 'onboarding' else 'reassessment' end
  into reason_value
  from public.profiles
  where id = user_id_value;

  if reason_value is null then
    raise exception using errcode = '23503', message = 'profile not found';
  end if;

  insert into public.suitability_assessments (
    user_id,
    questionnaire_version,
    answers,
    score,
    profile,
    target_allocation,
    reason
  )
  values (
    user_id_value,
    p_questionnaire_version,
    p_answers,
    score_value,
    profile_value,
    allocation_value,
    reason_value
  )
  returning id into assessment_id;

  update public.profiles
  set current_assessment_id = assessment_id,
      onboarding = 'complete',
      updated_at = now()
  where id = user_id_value;

  return assessment_id;
end;
$$;

revoke all on function public.complete_suitability(jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_suitability(jsonb, text) to authenticated;

commit;
