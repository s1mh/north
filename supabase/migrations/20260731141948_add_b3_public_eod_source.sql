begin;

insert into public.market_data_sources (
  id, display_name, kind, base_url, license_url, attribution
) values (
  'b3-public-eod',
  'B3 · fechamento diário',
  'open_data',
  'https://www.b3.com.br/pesquisapregao',
  'https://www.b3.com.br/en_us/market-data-and-indices/data-services/market-data/distributors/faq/',
  'Fonte: B3 · fechamento oficial D-1'
);

commit;
