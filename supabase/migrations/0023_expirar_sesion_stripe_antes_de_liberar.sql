-- ============================================================
-- SECOND VOW — 0023 · El barrido de pagos abandonados ahora puede
-- excluir pedidos que el proceso Node ya verificó como pagados en
-- Stripe (para no liberar por error un vestido que sí se cobró),
-- y su contraparte en Node (ver app/api/cron/expire-payments) cierra
-- primero la sesión de Stripe antes de tocar la base de datos.
-- Ejecutar DESPUÉS de 0022.
-- ============================================================
begin;

create or replace function public.backend_expire_abandoned_payments(p_skip_order_ids uuid[] default '{}'::uuid[])
returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer; r record;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;

  for r in
    select id, dress_id from public.orders
    where status='payment_processing' and payment_deadline_at<now()-interval '5 minutes'
      and not (id = any(p_skip_order_ids))
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
      and not (id = any(p_skip_order_ids))
  loop
    update public.orders set status='cancelled',payment_failure_code='offer_payment_window_expired',updated_at=now() where id=r.id;
    update public.dresses set status='approved' where id=r.dress_id and status in('reserved')
      and not exists(select 1 from public.orders x where x.dress_id=r.dress_id and x.id<>r.id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped'));
    perform public.backend_sync_offer_after_order_cancel(r.id, 'expired');
  end loop;

  return v_count;
end$$;
revoke all on function public.backend_expire_abandoned_payments(uuid[]) from public;

-- Helper de solo lectura para que el cron sepa qué pedidos están por
-- expirar y a qué sesión de Stripe pertenecen, antes de tocar nada.
create or replace function public.backend_list_expiring_checkouts()
returns table (order_id uuid, stripe_checkout_session_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  return query
  select id, stripe_checkout_session_id
  from public.orders
  where status='payment_processing'
    and payment_deadline_at < now() - interval '5 minutes'
    and stripe_checkout_session_id is not null;
end;
$$;
revoke all on function public.backend_list_expiring_checkouts() from public;

-- ------------------------------------------------------------
-- Reembolso automático SOLO para el pedido que perdió la carrera de
-- "primera en pagar gana" (dress_no_longer_available). A diferencia de
-- backend_record_refund (pensado para reclamaciones/cancelaciones), esta
-- función NUNCA toca el vestido: el vestido sigue perteneciendo al pedido
-- que sí ganó la carrera, y archivarlo aquí le rompería esa venta.
-- ------------------------------------------------------------
create or replace function public.backend_refund_losing_race_order(
  p_order_id uuid, p_provider_refund_id text, p_amount_mxn integer, p_status text
) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; v_payment uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  if p_amount_mxn is null or p_amount_mxn<=0 then raise exception 'Importe de reembolso inválido'; end if;
  if p_status not in('pending','processing','succeeded','failed','cancelled') then raise exception 'Estado inválido'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.status<>'payment_review' then raise exception 'Este pedido no está en revisión por carrera de pago'; end if;

  -- reason_code está restringido a un catálogo fijo (refunds_reason_check);
  -- 'duplicate' es el más apropiado para un segundo cobro por carrera de pago.
  select id into v_payment from public.payments where order_id=o.id and status in('paid','partially_refunded','refunded') order by created_at desc limit 1;
  insert into public.refunds(order_id,payment_id,provider,provider_refund_id,amount_mxn,reason_code,status,completed_at)
  values(o.id,v_payment,'stripe',p_provider_refund_id,p_amount_mxn,'duplicate',p_status,case when p_status='succeeded' then now() else null end)
  on conflict(provider_refund_id) do update set status=excluded.status,completed_at=case when excluded.status='succeeded' then coalesce(public.refunds.completed_at,now()) else public.refunds.completed_at end;

  if p_status='succeeded' then
    update public.payments set status='refunded',updated_at=now() where id=v_payment;
    -- El pedido queda 'refunded'. El vestido NO se toca aquí: lo administra
    -- el pedido que sí ganó la carrera.
    update public.orders set status='refunded',updated_at=now() where id=o.id;
    insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id)
    values(o.id,'refund',-p_amount_mxn,'stripe_refund',p_provider_refund_id) on conflict do nothing;
  end if;
end$$;
revoke all on function public.backend_refund_losing_race_order(uuid,text,integer,text) from public;

commit;
