-- SUPERSEDED, NOT APPLIED: historical proposal, do not apply independently.
-- Current authorized implementation: supervised_return_resolution, 16 October 2026.
begin;

alter table public.claims add column if not exists return_shipping_payment_mode text not null default 'prepaid'
  check (return_shipping_payment_mode in ('prepaid','collect'));

create or replace function public.seller_provide_return_label_v2(p_claim_id uuid,p_carrier text,p_tracking_number text,p_payment_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.claims; o public.orders;
begin
  if (select auth.uid()) is null then raise exception 'No autorizado'; end if;
  if p_payment_mode is null or p_payment_mode not in ('prepaid','collect') then raise exception 'Modalidad de pago inválida'; end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null then raise exception 'Reclamación inexistente'; end if;
  select * into o from public.orders where id=c.order_id for update;
  if o.seller_id is distinct from (select auth.uid()) then raise exception 'No autorizado'; end if;
  if p_payment_mode='collect' and coalesce(o.checkout_terms_version,'')<'2026-10-13.2' then raise exception 'Esta operación conserva la devolución con guía prepagada'; end if;
  perform public.seller_provide_return_label(p_claim_id,p_carrier,p_tracking_number);
  update public.claims set return_shipping_payment_mode=p_payment_mode where id=c.id;
  update public.notifications set title='Guía de devolución disponible',
    body=case when p_payment_mode='collect' then 'El flete de regreso lo paga la vendedora al recibir, no adelantes ese gasto, entrega el paquete dentro de cinco días naturales.' else 'La vendedora pagó la guía de regreso, no adelantes ese gasto, entrega el paquete dentro de cinco días naturales.' end,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('payment_mode',p_payment_mode)
  where order_id=o.id and kind='return_label_ready' and metadata->>'claim_id'=c.id::text;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'return_payment_mode_selected',jsonb_build_object('claim_id',c.id,'payment_mode',p_payment_mode));
end $$;
revoke all on function public.seller_provide_return_label_v2(uuid,text,text,text) from public,anon;
grant execute on function public.seller_provide_return_label_v2(uuid,text,text,text) to authenticated;

-- Factual administrative confirmation prevents a recipient's refusal from being
-- the only way to block a refund. It does not execute a payment or bypass appeal.
create or replace function public.admin_confirm_return_received(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; c public.claims;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<20 then raise exception 'Documenta la entrega o negativa injustificada con al menos 20 caracteres'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.status<>'return_shipped' then raise exception 'No existe devolución en tránsito'; end if;
  select * into c from public.claims where order_id=o.id and status='return_shipped' order by created_at desc limit 1 for update;
  if c.id is null or c.return_tracking_number is null then raise exception 'Falta devolución con guía registrada'; end if;
  update public.claims set status='refund_pending',return_delivered_at=coalesce(return_delivered_at,now()) where id=c.id;
  update public.orders set status='returned',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'return_received',jsonb_build_object('administrative_confirmation',true,'reason',btrim(p_reason),'claim_id',c.id));
end $$;
revoke all on function public.admin_confirm_return_received(uuid,text) from public,anon;
grant execute on function public.admin_confirm_return_received(uuid,text) to authenticated;

create or replace function public.notify_order_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text; v_title text; v_body text; v_event text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status='refund_pending' and new.shipping_block_reason='shipping_deadline_expired' then
    v_kind:='order_shipping_cancelled'; v_title:='Venta cancelada por falta de envío';
    v_body:='Venció el plazo de cinco días naturales sin guía registrada, no envíes el vestido, se tramita el reembolso completo al medio de pago original.';
    v_event:='shipping_deadline_expired';
  elsif new.status='completed' then
    v_kind:='order_completed'; v_title:='Venta concretada';
    v_body:='Terminó la revisión sin reclamación pendiente, consulta la disponibilidad del saldo en el pedido.'; v_event:='order_completed';
  elsif new.status='return_shipped' then
    v_kind:='order_return_shipped'; v_title:='Devolución en tránsito';
    v_body:='La devolución tiene guía registrada, el saldo permanece bloqueado hasta resolver el retorno y el reembolso.';
  elsif new.status='returned' then
    v_kind:='order_return_received'; v_title:='Devolución recibida';
    v_body:='Se confirmó la devolución, el reembolso se procesa después de finalizar la revisión de la decisión.';
  elsif new.status='refunded' then
    v_kind:='refund_confirmed'; v_title:='Reembolso confirmado';
    v_body:='Se confirmó el reembolso al medio de pago original, consulta el importe en el pedido, la vendedora no recibe saldo de esta venta.';
  else return new;
  end if;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  select x.user_id,new.id,case when new.status='refunded' and new.shipping_block_reason='shipping_deadline_expired' and x.user_id=new.seller_id then 'order_cancelled_no_shipping' else v_kind end,v_title,v_body,jsonb_build_object('href_path','/pedidos/'||new.id::text)
  from (values(new.buyer_id),(new.seller_id)) x(user_id)
  where not exists(select 1 from public.notifications n where n.user_id=x.user_id and n.order_id=new.id and n.kind=case when new.status='refunded' and new.shipping_block_reason='shipping_deadline_expired' and x.user_id=new.seller_id then 'order_cancelled_no_shipping' else v_kind end)
  on conflict do nothing;
  if v_event is not null and not exists(select 1 from public.order_events e where e.order_id=new.id and e.event_type=v_event) then
    insert into public.order_events(order_id,event_type,metadata) values(new.id,v_event,jsonb_build_object('status',new.status));
  end if;
  return new;
end $$;
revoke all on function public.notify_order_lifecycle() from public,anon,authenticated;
drop trigger if exists notify_order_lifecycle on public.orders;
create trigger notify_order_lifecycle after update of status on public.orders for each row execute function public.notify_order_lifecycle();

create or replace function public.claim_decision_prepaid_copy()
returns trigger language plpgsql set search_path='' as $$
declare o public.orders; r public.claim_resolutions;
begin
  if new.kind='claim_decision' and new.order_id is not null then
    select * into o from public.orders where id=new.order_id;
    select * into r from public.claim_resolutions where order_id=new.order_id order by decided_at desc limit 1;
    if r.decision='authorize_return' and r.liability='seller' then
      if new.user_id=o.buyer_id then
        new.body:='Se autorizó la devolución, la vendedora asume el flete y debe compartir la guía, no adelantes ese gasto, revisa el pedido para descargarla cuando esté lista.';
      elsif new.user_id=o.seller_id then
        new.body:='Se autorizó la devolución atribuible a la vendedora, comparte la guía de regreso dentro del plazo indicado y asume el flete, revisa en el pedido la modalidad disponible para esta operación.';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.claim_decision_prepaid_copy() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
