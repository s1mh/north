begin;

insert into public.market_data_sources (
  id, display_name, kind, base_url, license_url, attribution
) values (
  'tesouro-transparente',
  'Tesouro Nacional · Tesouro Transparente',
  'open_data',
  'https://www.tesourotransparente.gov.br',
  'https://www.tesourotransparente.gov.br',
  'Fonte: Tesouro Nacional · Tesouro Transparente'
)
on conflict (id) do nothing;

commit;
