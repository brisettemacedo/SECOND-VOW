-- Ejecutar primero en Supabase SQL Editor. Es solo lectura.
select p.proname as funcion, pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('accept_offer','cancel_offer','create_offer','backend_prepare_order_financials')
order by p.proname;

select seller_commission_bps,is_active,effective_from,effective_until
from public.marketplace_fee_configs order by effective_from desc;

select version from supabase_migrations.schema_migrations
where version in('0028','0029','0030') order by version;
