-- Ajusta mark_order_shipped al esquema real de shipments. Las confirmaciones
-- de seguro y firma viven en orders; shipments conserva la guía rastreable y
-- el requisito de entrega contra identificación.
create or replace function public.mark_order_shipped(
  p_order_id uuid,
  p_carrier text,
  p_tracking_number text,
  p_insured boolean default false,
  p_signature boolean default false,
  p_id_delivery boolean default false,
  p_evidence_retained boolean default false
)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.status not in('paid','preparing_shipment') or o.shipping_blocked_at is not null then raise exception 'El pedido no puede enviarse'; end if;
  if o.seller_ship_by is not null and now()>o.seller_ship_by then raise exception 'El plazo de cinco días naturales venció'; end if;
  if nullif(btrim(coalesce(p_carrier,'')),'') is null or nullif(btrim(coalesce(p_tracking_number,'')),'') is null then raise exception 'Paquetería y guía son obligatorias'; end if;
  if not p_insured or not p_signature or not p_id_delivery then raise exception 'El envío debe incluir seguro, firma y entrega contra identificación'; end if;
  if not p_evidence_retained then raise exception 'Confirma que conservaste la evidencia de la operación'; end if;

  insert into public.shipments(order_id,direction,carrier,tracking_number,status,id_delivery_required,shipped_at)
  values(o.id,'outbound',btrim(p_carrier),btrim(p_tracking_number),'in_transit',true,now())
  on conflict(order_id) where direction='outbound' do update set
    carrier=excluded.carrier,
    tracking_number=excluded.tracking_number,
    status='in_transit',
    id_delivery_required=true,
    shipped_at=coalesce(public.shipments.shipped_at,now()),
    updated_at=now();

  update public.orders set
    status='shipped',
    carrier=btrim(p_carrier),
    tracking_number=btrim(p_tracking_number),
    shipped_at=coalesce(shipped_at,now()),
    shipping_insurance_confirmed=true,
    shipping_signature_confirmed=true,
    seller_id_delivery_acknowledged_at=now(),
    seller_evidence_completed_at=now(),
    updated_at=now()
  where id=o.id;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'shipped',jsonb_build_object('carrier',btrim(p_carrier),'tracking_number',btrim(p_tracking_number),'insured',true,'signature',true,'id_delivery',true,'evidence_retained',true));

  insert into public.notifications(user_id,order_id,dress_id,kind,title,body)
  values(o.buyer_id,o.id,o.dress_id,'shipment_registered','Tu vestido fue enviado','Guía '||btrim(p_tracking_number)||' con '||btrim(p_carrier)||'. Ya puedes seguir el envío desde tu pedido. La entrega requiere firma e identificación oficial.');
end $$;

revoke all on function public.mark_order_shipped(uuid,text,text,boolean,boolean,boolean,boolean) from public;
grant execute on function public.mark_order_shipped(uuid,text,text,boolean,boolean,boolean,boolean) to authenticated;

notify pgrst, 'reload schema';
