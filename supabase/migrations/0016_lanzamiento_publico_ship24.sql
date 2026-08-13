-- ============================================================
-- SECOND VOW 0016 - Lanzamiento público, folio de pedido y trazabilidad
-- Ejecutar DESPUÉS de 0015.
-- ============================================================
begin;

create sequence if not exists public.order_public_code_seq start with 1 increment by 1;
alter table public.orders add column if not exists public_code text;

create or replace function public.assign_order_public_code()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.public_code is null then
    new.public_code := 'SV-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(nextval('public.order_public_code_seq')::text, 6, '0');
  end if;
  return new;
end;$$;

drop trigger if exists trg_assign_order_public_code on public.orders;
create trigger trg_assign_order_public_code before insert on public.orders
for each row execute function public.assign_order_public_code();

-- Backfill de pedidos existentes.
-- La tabla orders tiene un trigger de seguridad que bloquea UPDATEs sin auth.uid(),
-- incluso cuando la migración se ejecuta desde SQL Editor. Lo deshabilitamos SOLO
-- durante este backfill técnico y lo reactivamos inmediatamente después.
alter table public.orders disable trigger orders_enforce_update;

with missing as (
  select id, row_number() over(order by created_at,id) as rn, extract(year from created_at)::int as yr
  from public.orders where public_code is null
)
update public.orders o
set public_code='SV-'||m.yr::text||'-'||lpad(m.rn::text,6,'0')
from missing m where o.id=m.id;

alter table public.orders enable trigger orders_enforce_update;

create unique index if not exists orders_public_code_unique on public.orders(public_code) where public_code is not null;

commit;
