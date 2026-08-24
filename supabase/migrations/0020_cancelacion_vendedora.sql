-- SECOND VOW 0020 — cancelación solicitada por la vendedora
-- Ejecutar después de 0019. La cancelación solo es unilateral antes del envío.
begin;

create or replace function public.seller_request_order_cancellation(p_order_id uuid,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare o public.orders; v_reason text;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
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
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.buyer_id,o.id,'seller_cancelled_after_payment','Venta cancelada por la vendedora','La vendedora canceló antes del envío. SECOND VOW solicitó el reembolso completo al medio de pago original.') on conflict do nothing;
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.seller_id,o.id,'seller_cancellation_confirmed','Cancelación registrada','El envío quedó bloqueado. El vestido volverá a publicarse cuando Stripe confirme el reembolso.') on conflict do nothing;
    insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'seller_cancelled',jsonb_build_object('stage','after_payment_before_shipping','reason',v_reason));
    return 'refund';
  end if;
  raise exception 'La venta ya no puede cancelarse en su estado actual';
end$$;
revoke all on function public.seller_request_order_cancellation(uuid,text) from public;
grant execute on function public.seller_request_order_cancellation(uuid,text) to authenticated;

-- Se ejecuta al final de la transacción del webhook, después de la función
-- histórica que archiva el vestido, y lo republica solo cuando nunca se envió.
create or replace function public.deferred_republish_cancelled_sale()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='refunded' and new.shipped_at is null and new.shipping_block_reason in('seller_cancelled','shipping_deadline_expired') then
    update public.dresses set status='approved' where id=new.dress_id;
  end if;
  return new;
end$$;
drop trigger if exists trg_deferred_republish_cancelled_sale on public.orders;
create constraint trigger trg_deferred_republish_cancelled_sale after update of status on public.orders deferrable initially deferred for each row execute function public.deferred_republish_cancelled_sale();

commit;
