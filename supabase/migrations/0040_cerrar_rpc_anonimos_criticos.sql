-- SECOND VOW 0040 — cierra RPC administrativos y de backend a solicitudes anónimas
begin;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature,p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and (p.proname like 'backend\_%' escape '\' or p.proname like 'admin\_%' escape '\')
  loop
    execute format('revoke execute on function %s from public, anon',r.signature);
    if r.proname like 'backend\_%' escape '\' then
      execute format('revoke execute on function %s from authenticated',r.signature);
      execute format('grant execute on function %s to service_role',r.signature);
    else
      execute format('grant execute on function %s to authenticated, service_role',r.signature);
    end if;
  end loop;
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname=any(array[
      'accept_offer','accept_order_checkout_terms','accept_order_checkout_terms_v2','accept_order_condition',
      'acknowledge_id_delivery','cancel_offer','confirm_order_delivered','confirm_return_received','create_offer',
      'decline_offer','delete_own_dress_photo','expire_stale_offers','get_or_create_conversation',
      'mark_conversation_read','mark_order_shipped','open_order_claim','refresh_my_offer_reminders',
      'register_return_shipment','remove_own_dress_listing','request_seller_payout','seller_request_order_cancellation',
      'set_conversation_shipping_destination','set_order_shipping_quote','set_own_dress_primary_photo',
      'submit_dress_for_review','appeal_claim_resolution'
    ])
  loop
    execute format('revoke execute on function %s from public, anon',r.signature);
    execute format('grant execute on function %s to authenticated, service_role',r.signature);
  end loop;
end;
$$;

-- Esta función solo vence una reserva que ya está caducada y se usa al abrir
-- una ficha pública. Es la única operación anónima deliberada de esta lista.
revoke execute on function public.expire_dress_reservation_if_stale(uuid) from public;
grant execute on function public.expire_dress_reservation_if_stale(uuid) to anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
