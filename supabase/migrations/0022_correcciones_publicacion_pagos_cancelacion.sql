-- ============================================================
-- SECOND VOW — 0022 · Publicación inmediata, corrección de marca,
-- campos opcionales, cancelación consistente y cierre de pedidos
-- vencidos (con backfill para usuarias existentes).
-- Ejecutar DESPUÉS de 0001–0021. No borra vestidos ni usuarias.
-- ============================================================
begin;

-- ------------------------------------------------------------
-- 1) Tela principal, color principal y cola dejan de ser
--    obligatorios para publicar. Siguen siendo seleccionables
--    y se recomienda completarlos, pero no bloquean el envío
--    a revisión ni la publicación.
-- ------------------------------------------------------------
alter table public.dresses
  drop constraint if exists dresses_completa_antes_de_revision;

alter table public.dresses
  add constraint dresses_completa_antes_de_revision check (
    status in ('draft', 'changes_requested', 'rejected', 'archived')
    or (
      nullif(btrim(talla_etiqueta), '') is not null
      and silueta is not null
      and escote is not null
      and espalda is not null
      and manga is not null
      and condicion is not null
      and precio_venta_mxn is not null
      and envio_nacional = true
      and (brand_id is not null or brand_suggestion_id is not null)
    )
  );

-- ------------------------------------------------------------
-- 2) Publicación inmediata: enviar a revisión ya NO deja el
--    vestido en cola de moderación manual. Se publica directo
--    como 'approved'. Una marca sugerida y aún pendiente NO
--    detiene la publicación (solo se corrige/vincula después).
--    El único motivo de bloqueo real es que la marca sugerida
--    ya haya sido RECHAZADA (igual que antes).
-- ------------------------------------------------------------
create or replace function public.submit_dress_for_review(p_dress_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dress public.dresses;
begin
  select * into v_dress from public.dresses where id = p_dress_id for update;
  if v_dress.id is null then raise exception 'Publicación inexistente'; end if;
  if v_dress.seller_id <> auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if v_dress.status not in ('draft', 'changes_requested', 'rejected', 'pending_review') then
    raise exception 'La publicación ya fue enviada';
  end if;

  if not exists (
    select 1 from public.dress_declarations x
    where x.dress_id = v_dress.id and x.seller_id = v_dress.seller_id
      and x.authenticity_declared and x.photos_correspond_declared
      and x.right_to_sell_declared and x.information_true_declared
  ) then
    raise exception 'Debes aceptar las declaraciones de publicación antes de enviar a revisión';
  end if;

  if v_dress.brand_suggestion_id is not null
     and exists(select 1 from public.brand_suggestions bs where bs.id = v_dress.brand_suggestion_id and bs.status = 'rejected') then
    raise exception 'La marca sugerida fue rechazada. Selecciona o sugiere otra marca';
  end if;

  -- La restricción dresses_completa_antes_de_revision valida el resto de
  -- campos obligatorios; si falta algo, este UPDATE fallará con ese mensaje.
  update public.dresses
  set status = 'approved', published_at = coalesce(published_at, now()), updated_at = now()
  where id = v_dress.id;

  insert into public.dress_moderation_history(dress_id, action, status_from, status_to, comments, admin_id)
  values (v_dress.id, 'approved', v_dress.status, 'approved', 'Publicación automática al completar el formulario.', coalesce(auth.uid(), v_dress.seller_id));

  return 'approved';
end;
$$;
revoke all on function public.submit_dress_for_review(uuid) from public;
grant execute on function public.submit_dress_for_review(uuid) to authenticated;

-- admin_moderate_dress ahora también puede actuar DESPUÉS de publicado
-- (retirar o pedir cambios a un vestido ya visible), no solo sobre la
-- cola histórica de 'pending_review' que ya no se usa para publicaciones
-- nuevas pero puede seguir teniendo vestidos antiguos.
create or replace function public.admin_moderate_dress(
  p_dress_id uuid,
  p_action text,
  p_comments text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dress public.dresses;
  v_target text;
  v_comments text := nullif(btrim(coalesce(p_comments,'')), '');
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_action not in ('approved','changes_requested','rejected') then raise exception 'Acción de moderación inválida'; end if;

  select * into v_dress from public.dresses where id = p_dress_id for update;
  if v_dress.id is null then raise exception 'Publicación inexistente'; end if;
  if v_dress.status not in ('pending_review','approved') then
    raise exception 'La publicación no está en un estado que admita moderación';
  end if;
  if p_action in ('changes_requested','rejected') and v_comments is null then
    raise exception 'Debes indicar el motivo';
  end if;

  v_target := p_action;
  update public.dresses
  set status = v_target, moderation_notes = v_comments, moderated_by = auth.uid(), moderated_at = now()
  where id = p_dress_id;

  insert into public.dress_moderation_history(dress_id, action, status_from, status_to, comments, admin_id)
  values (p_dress_id, p_action, v_dress.status, v_target, v_comments, auth.uid());

  return v_target;
end;
$$;
revoke all on function public.admin_moderate_dress(uuid,text,text) from public;
grant execute on function public.admin_moderate_dress(uuid,text,text) to authenticated;

-- ------------------------------------------------------------
-- 3) Corrección de marca antes/al aprobar una sugerencia, y
--    publicación automática del vestido vinculado si ya estaba
--    completo y solo le faltaba la marca.
-- ------------------------------------------------------------
create or replace function public.admin_resolve_brand_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_existing_brand_id uuid default null,
  p_notes text default null,
  p_corrected_name text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.brand_suggestions;
  v_brand_id uuid;
  v_name text;
  v_dress public.dresses;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_action not in ('approve_new','link_existing','reject') then raise exception 'Acción inválida'; end if;
  select * into v_s from public.brand_suggestions where id=p_suggestion_id for update;
  if v_s.id is null then raise exception 'Sugerencia inexistente'; end if;

  if p_action='reject' then
    update public.brand_suggestions set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), review_notes=p_notes, resolved_brand_id=null where id=v_s.id;
    return null;
  end if;

  if p_action='link_existing' then
    if p_existing_brand_id is null or not exists(select 1 from public.brands b where b.id=p_existing_brand_id) then raise exception 'Marca destino inválida'; end if;
    v_brand_id:=p_existing_brand_id;
  else
    -- Nombre corregido por la administradora, si se proporcionó; si no, el original.
    v_name := coalesce(nullif(btrim(p_corrected_name), ''), v_s.suggested_name);
    select b.id into v_brand_id from public.brands b where lower(btrim(b.name))=lower(btrim(v_name)) limit 1;
    if v_brand_id is null then
      insert into public.brands(name,is_active) values(btrim(v_name),true) returning id into v_brand_id;
    end if;
  end if;

  update public.brand_suggestions
    set status='approved', resolved_brand_id=v_brand_id, reviewed_by=auth.uid(), reviewed_at=now(), review_notes=p_notes
    where id=v_s.id;
  update public.dresses set brand_id=v_brand_id, brand_suggestion_id=null where brand_suggestion_id=v_s.id;

  -- El vestido que dependía únicamente de esta marca para publicarse:
  -- si ya cumple el resto de campos obligatorios, se publica ahora mismo.
  for v_dress in
    select d.* from public.dresses d
    where d.brand_id = v_brand_id and d.status in ('draft','pending_review')
      and nullif(btrim(d.talla_etiqueta), '') is not null
      and d.silueta is not null and d.escote is not null and d.espalda is not null and d.manga is not null
      and d.condicion is not null and d.precio_venta_mxn is not null and d.envio_nacional = true
      and exists (
        select 1 from public.dress_declarations x
        where x.dress_id = d.id and x.seller_id = d.seller_id
          and x.authenticity_declared and x.photos_correspond_declared
          and x.right_to_sell_declared and x.information_true_declared
      )
      and exists (select 1 from public.dress_photos p where p.dress_id = d.id)
      and d.updated_at > now() - interval '180 days'
  loop
    update public.dresses set status='approved', published_at=coalesce(published_at, now()), updated_at=now() where id=v_dress.id;
    insert into public.dress_moderation_history(dress_id, action, status_from, status_to, comments, admin_id)
    values (v_dress.id, 'approved', v_dress.status, 'approved', 'Publicación automática al resolverse la marca pendiente.', auth.uid());
  end loop;

  return v_brand_id;
end;
$$;
revoke all on function public.admin_resolve_brand_suggestion(uuid,text,uuid,text,text) from public;
grant execute on function public.admin_resolve_brand_suggestion(uuid,text,uuid,text,text) to authenticated;

-- ------------------------------------------------------------
-- 4) Ofertas: 48 horas para pagar tras aceptarse (no 24h).
-- ------------------------------------------------------------
create or replace function public.accept_offer(p_offer_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.offers; v_order uuid; v_commission integer;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null then raise exception 'Oferta inexistente'; end if;
  if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if o.status<>'pending' or o.expires_at<now() then raise exception 'Oferta no disponible'; end if;
  if exists(select 1 from public.orders where dress_id=o.dress_id and status in('awaiting_payment','payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped')) then
    raise exception 'El vestido ya tiene una operación activa';
  end if;
  v_commission:=round(o.amount_mxn*.18);
  update public.offers set status='accepted',updated_at=now() where id=o.id;
  update public.offers set status='rejected',updated_at=now() where dress_id=o.dress_id and id<>o.id and status='pending';
  insert into public.orders(dress_id,offer_id,buyer_id,seller_id,subtotal_mxn,commission_mxn,total_mxn,seller_net_mxn,payment_deadline_at)
  values(o.dress_id,o.id,o.buyer_id,o.seller_id,o.amount_mxn,v_commission,o.amount_mxn,o.amount_mxn-v_commission,now()+interval '48 hours')
  returning id into v_order;
  return v_order;
end$$;
revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5) Helper único para sincronizar una oferta cuando su pedido
--    se cancela, por la razón que sea. Evita que quede una
--    oferta "accepted" fantasma después de cancelar el pedido.
-- ------------------------------------------------------------
create or replace function public.backend_sync_offer_after_order_cancel(p_order_id uuid, p_offer_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_offer_id uuid;
begin
  if p_offer_status not in ('expired','cancelled','rejected') then raise exception 'Estado de oferta inválido'; end if;
  select offer_id into v_offer_id from public.orders where id=p_order_id;
  if v_offer_id is null then return; end if;
  update public.offers set status=p_offer_status, updated_at=now()
  where id=v_offer_id and status='accepted';
end$$;
revoke all on function public.backend_sync_offer_after_order_cancel(uuid,text) from public;

-- ------------------------------------------------------------
-- 6) Cancelación por la vendedora: ahora también permitida por
--    administración (para intervenir cuando la vendedora no
--    puede resolverlo), y sincroniza la oferta vinculada.
-- ------------------------------------------------------------
create or replace function public.seller_request_order_cancellation(p_order_id uuid,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare o public.orders; v_reason text;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  v_reason:=nullif(btrim(p_reason),'');
  if v_reason is null or length(v_reason)<5 then raise exception 'Indica brevemente el motivo de la cancelación'; end if;
  if o.shipped_at is not null or o.status in('shipped','delivered','inspection','completed','claim_open','return_authorized','return_shipped','returned') then
    raise exception 'La venta ya fue enviada y no puede cancelarse unilateralmente';
  end if;
  if o.status in('payment_review','chargeback_open') or(o.stripe_dispute_status is not null and o.stripe_dispute_status<>'won') then
    raise exception 'El pago está en revisión; administración debe resolverlo sin emitir un reembolso duplicado';
  end if;
  if o.status='awaiting_payment' then
    update public.orders set status='cancelled',cancelled_at=now(),cancellation_reason='seller_cancelled: '||v_reason,updated_at=now() where id=o.id;
    update public.dresses set status='approved' where id=o.dress_id and status='reserved';
    perform public.backend_sync_offer_after_order_cancel(o.id, 'cancelled');
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.buyer_id,o.id,'seller_cancelled_before_payment','Venta cancelada por la vendedora','La vendedora canceló la operación antes de que se realizara el pago.') on conflict do nothing;
    insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'seller_cancelled',jsonb_build_object('stage','before_payment','reason',v_reason));
    return 'cancelled';
  end if;
  if o.status='payment_processing' then
    insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'seller_cancellation_requested',jsonb_build_object('stage','checkout_open','reason',v_reason));
    return 'expire_checkout';
  end if;
  if o.status in('paid','preparing_shipment') then
    update public.orders set status='refund_pending',shipping_blocked_at=coalesce(shipping_blocked_at,now()),shipping_block_reason='seller_cancelled',
      cancelled_at=now(),cancellation_reason='seller_cancelled: '||v_reason,updated_at=now() where id=o.id;
    update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in('held','releasable','requested');
    perform public.backend_sync_offer_after_order_cancel(o.id, 'cancelled');
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.buyer_id,o.id,'seller_cancelled_after_payment','Venta cancelada por la vendedora','La vendedora canceló antes del envío. SECOND VOW solicitó el reembolso completo al medio de pago original.') on conflict do nothing;
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.seller_id,o.id,'seller_cancellation_confirmed','Cancelación registrada','El envío quedó bloqueado. El vestido volverá a publicarse cuando Stripe confirme el reembolso.') on conflict do nothing;
    insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'seller_cancelled',jsonb_build_object('stage','after_payment_before_shipping','reason',v_reason));
    return 'refund';
  end if;
  raise exception 'La venta ya no puede cancelarse en su estado actual';
end$$;
revoke all on function public.seller_request_order_cancellation(uuid,text) from public;
grant execute on function public.seller_request_order_cancellation(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- 7) Cotización de envío: también permitida por administración.
-- ------------------------------------------------------------
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
  if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'Solo la vendedora puede cotizar el envío'; end if;
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

-- ------------------------------------------------------------
-- 8) Cierre de pedidos vencidos (ampliado): además de cancelar
--    el pedido y liberar el vestido, sincroniza la oferta
--    vinculada. Se puede invocar por cron con mayor frecuencia.
-- ------------------------------------------------------------
create or replace function public.backend_expire_abandoned_payments() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer; r record;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;

  for r in
    select id, dress_id from public.orders
    where status='payment_processing' and payment_deadline_at<now()-interval '5 minutes'
  loop
    update public.orders set status='cancelled',payment_failure_code='checkout_expired',updated_at=now() where id=r.id;
    update public.dresses set status='approved' where id=r.dress_id and status='reserved'
      and not exists(select 1 from public.orders x where x.dress_id=r.dress_id and x.id<>r.id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped'));
    perform public.backend_sync_offer_after_order_cancel(r.id, 'expired');
  end loop;
  get diagnostics v_count = row_count;

  for r in
    select id, dress_id from public.orders
    where status='awaiting_payment' and payment_deadline_at<now()
  loop
    update public.orders set status='cancelled',payment_failure_code='offer_payment_window_expired',updated_at=now() where id=r.id;
    update public.dresses set status='approved' where id=r.dress_id and status in('reserved')
      and not exists(select 1 from public.orders x where x.dress_id=r.dress_id and x.id<>r.id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped'));
    perform public.backend_sync_offer_after_order_cancel(r.id, 'expired');
  end loop;

  return v_count;
end$$;
revoke all on function public.backend_expire_abandoned_payments() from public;

-- ------------------------------------------------------------
-- 9) BACKFILL — corrige a las usuarias ya existentes ahora
--    mismo, no solo hacia adelante.
-- ------------------------------------------------------------

-- 9a) Cierra pedidos ya vencidos que quedaron atorados (algunos
--     llevan días), libera sus vestidos y sincroniza sus ofertas.
do $$
declare r record;
begin
  for r in
    select id, dress_id from public.orders
    where status='payment_processing' and payment_deadline_at<now()-interval '5 minutes'
  loop
    update public.orders set status='cancelled',payment_failure_code='checkout_expired',updated_at=now() where id=r.id;
    update public.dresses set status='approved' where id=r.dress_id and status='reserved';
    update public.offers set status='expired',updated_at=now() where id=(select offer_id from public.orders where id=r.id) and status='accepted';
  end loop;

  for r in
    select id, dress_id from public.orders
    where status='awaiting_payment' and payment_deadline_at<now()
  loop
    update public.orders set status='cancelled',payment_failure_code='offer_payment_window_expired',updated_at=now() where id=r.id;
    update public.dresses set status='approved' where id=r.dress_id and status='reserved';
    update public.offers set status='expired',updated_at=now() where id=(select offer_id from public.orders where id=r.id) and status='accepted';
  end loop;
end $$;

-- 9b) Cualquier oferta que quedó marcada "accepted" mientras su
--     pedido ya está en un estado terminal (histórico, de antes
--     de esta corrección) se corrige a un estado consistente.
update public.offers of
set status = case
    when o.status = 'cancelled' and o.cancellation_reason ilike 'seller_cancelled%' then 'cancelled'
    when o.status = 'cancelled' then 'expired'
    when o.status in ('refunded','returned') then 'expired'
    else of.status
  end,
  updated_at = now()
from public.orders o
where o.offer_id = of.id
  and of.status = 'accepted'
  and o.status in ('cancelled','refunded','returned');

-- 9c) Cualquier vestido que quedó en 'reserved' sin ningún pedido
--     activo real (huérfano de una corrida anterior del bug) se
--     restablece a disponible.
update public.dresses d
set status = 'approved', updated_at = now()
where d.status = 'reserved'
  and not exists (
    select 1 from public.orders o
    where o.dress_id = d.id
      and o.status in ('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped')
  );

-- 9d) Publica automáticamente los borradores/antiguos "pending_review"
--     que ya tienen marca resuelta (brand_id) y cumplen el resto de
--     requisitos, fotos y declaraciones — solo les faltaba que alguien
--     resolviera la marca o los aprobara manualmente.
do $$
declare v_dress record; v_count integer := 0;
begin
  for v_dress in
    select d.id from public.dresses d
    where d.status in ('draft','pending_review')
      and d.brand_id is not null
      and nullif(btrim(d.talla_etiqueta), '') is not null
      and d.silueta is not null and d.escote is not null and d.espalda is not null and d.manga is not null
      and d.condicion is not null and d.precio_venta_mxn is not null and d.envio_nacional = true
      and exists (
        select 1 from public.dress_declarations x
        where x.dress_id = d.id and x.seller_id = d.seller_id
          and x.authenticity_declared and x.photos_correspond_declared
          and x.right_to_sell_declared and x.information_true_declared
      )
      and exists (select 1 from public.dress_photos p where p.dress_id = d.id)
  loop
    update public.dresses set status='approved', published_at=coalesce(published_at, now()), updated_at=now() where id=v_dress.id;
    insert into public.dress_moderation_history(dress_id, action, status_from, status_to, comments, admin_id)
    select v_dress.id, 'approved', 'draft', 'approved', 'Publicación automática (backfill 0022): marca ya resuelta y publicación completa.', p.id
    from public.profiles p where p.role='admin' limit 1;
    v_count := v_count + 1;
  end loop;
  raise notice 'SECOND VOW 0022: % publicaciones antiguas se publicaron automáticamente.', v_count;
end $$;

-- ------------------------------------------------------------
-- 10) Vista de administración: vestidos con marca ya resuelta
--     (o sin marca pendiente) que NO se pudieron publicar solo
--     porque falta información — para dar seguimiento a la
--     vendedora, en vez de que se pierdan silenciosamente.
-- ------------------------------------------------------------
create or replace function public.admin_list_stalled_drafts()
returns table (
  id uuid, seller_id uuid, brand_id uuid, brand_suggestion_id uuid, model text, status text, updated_at timestamptz,
  falta_talla boolean, falta_diseno boolean, falta_condicion boolean, falta_precio boolean,
  falta_fotos boolean, falta_declaraciones boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return query
  select
    d.id, d.seller_id, d.brand_id, d.brand_suggestion_id, d.model, d.status, d.updated_at,
    (nullif(btrim(d.talla_etiqueta), '') is null) as falta_talla,
    (d.silueta is null or d.escote is null or d.espalda is null or d.manga is null) as falta_diseno,
    (d.condicion is null) as falta_condicion,
    (d.precio_venta_mxn is null) as falta_precio,
    (not exists(select 1 from public.dress_photos p where p.dress_id=d.id)) as falta_fotos,
    (not exists(
      select 1 from public.dress_declarations x where x.dress_id=d.id and x.seller_id=d.seller_id
        and x.authenticity_declared and x.photos_correspond_declared and x.right_to_sell_declared and x.information_true_declared
    )) as falta_declaraciones
  from public.dresses d
  where d.status in ('draft','pending_review')
    and (d.brand_id is not null or d.brand_suggestion_id is not null)
    and d.updated_at > now() - interval '365 days';
end;
$$;
revoke all on function public.admin_list_stalled_drafts() from public;
grant execute on function public.admin_list_stalled_drafts() to authenticated;

commit;
