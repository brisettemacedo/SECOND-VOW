-- ============================================================
-- SECOND VOW — 0014 · Cotización de envío antes del pago
-- Ejecutar DESPUÉS de 0013.
-- ============================================================

begin;

-- Permite a la vendedora cotizar el envío de un pedido que todavía espera pago,
-- sin abrir permisos directos de actualización sobre importes sensibles.
create or replace function public.set_order_shipping_quote(
  p_order_id uuid,
  p_shipping_mxn integer,
  p_carrier text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.seller_id<>auth.uid() then raise exception 'Solo la vendedora puede cotizar el envío'; end if;
  if o.status<>'awaiting_payment' then raise exception 'La cotización solo puede modificarse antes del pago'; end if;
  if p_shipping_mxn is null or p_shipping_mxn<0 then raise exception 'Costo de envío inválido'; end if;

  update public.orders
  set shipping_mxn=p_shipping_mxn,
      shipping_carrier_declared=nullif(btrim(p_carrier),''),
      shipping_quote_set_at=now(),
      total_mxn=subtotal_mxn+p_shipping_mxn,
      updated_at=now()
  where id=o.id
  returning * into o;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,auth.uid(),'shipping_quote_set',jsonb_build_object('shipping_mxn',p_shipping_mxn,'carrier',nullif(btrim(p_carrier),'')));

  return o;
end;
$$;

revoke all on function public.set_order_shipping_quote(uuid,integer,text) from public;
grant execute on function public.set_order_shipping_quote(uuid,integer,text) to authenticated;

-- La protección de updates existente bloqueaba cualquier cambio de importes por la vendedora.
-- Abrimos únicamente el caso de cotización previa al pago. Los campos siguen sin tener GRANT
-- directo para authenticated, por lo que esta ruta se usa mediante la RPC anterior.
create or replace function public.enforce_order_update() returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if public.is_admin() or auth.role()='service_role' then new.updated_at:=now();return new;end if;

  if auth.uid()=old.seller_id then
    if old.status='awaiting_payment' and new.status='awaiting_payment' then
      if new.buyer_id is distinct from old.buyer_id
        or new.seller_id is distinct from old.seller_id
        or new.dress_id is distinct from old.dress_id
        or new.subtotal_mxn is distinct from old.subtotal_mxn
        or new.commission_mxn is distinct from old.commission_mxn
        or new.seller_net_mxn is distinct from old.seller_net_mxn
        or new.carrier is distinct from old.carrier
        or new.tracking_number is distinct from old.tracking_number
        or new.shipped_at is distinct from old.shipped_at
        or new.delivered_at is distinct from old.delivered_at
        or new.claim_deadline_at is distinct from old.claim_deadline_at
      then raise exception 'Solo puedes actualizar la cotización de envío antes del pago'; end if;
      if new.shipping_mxn<0 then raise exception 'Costo de envío inválido'; end if;
      if new.total_mxn<>new.subtotal_mxn+new.shipping_mxn then raise exception 'Total de pedido inválido'; end if;
      new.updated_at:=now();return new;
    elsif old.status in('paid','preparing_shipment') and new.status='shipped' and nullif(btrim(new.tracking_number),'') is not null and nullif(btrim(new.carrier),'') is not null then
      new.updated_at:=now();return new;
    else
      raise exception 'Transición de pedido no permitida para la vendedora';
    end if;
  elsif auth.uid()=old.buyer_id then
    if not(old.status='shipped' and new.status='delivered') then raise exception 'Transición de pedido no permitida para la compradora';end if;
    if new.buyer_id<>old.buyer_id or new.seller_id<>old.seller_id or new.dress_id<>old.dress_id or new.subtotal_mxn<>old.subtotal_mxn or new.commission_mxn<>old.commission_mxn or new.total_mxn<>old.total_mxn or new.seller_net_mxn<>old.seller_net_mxn then raise exception 'No se pueden alterar importes o participantes';end if;
    new.delivered_at:=coalesce(new.delivered_at,now());new.claim_deadline_at:=coalesce(new.claim_deadline_at,now()+interval '72 hours');
    new.updated_at:=now();return new;
  else
    raise exception 'No autorizado';
  end if;
end;
$$;

commit;
