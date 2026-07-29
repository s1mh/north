begin;

grant select, insert, update, delete on public.market_data_sources to service_role;
grant select, insert, update, delete on public.market_indicators to service_role;
grant select, insert, update, delete on public.market_instruments to service_role;
grant select, insert, update, delete on public.market_prices to service_role;
grant select, insert, update, delete on public.market_ingestion_runs to service_role;
grant select, insert, update, delete on public.market_data_alerts to service_role;

commit;
