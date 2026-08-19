-- SECOND VOW 0018 — cierre de producción: comisión total 18%, checkout atómico,
-- pagos tardíos, conciliación e idempotencia. Ejecutar una sola vez después de 0017.
begin;

-- 1) Política comercial: 18% total sobre el precio del vestido. El costo del
-- procesador queda absorbido por SECOND VOW. Sin cargo administrativo adicional.
update public.marketplace_fee_configs set is_active=false where is_active=true;
insert into public.marketplace_fee_configs(
  seller_commission_bps,seller_admin_fixed_mxn,listing_fee_mxn,
  buyer_protection_bps,buyer_protection_fixed_mxn,
  processor_fee_borne_by,shipping_payer,shipping_model,charge_model,is_active
) values(1800,0,0,0,0,'platform','buyer','seller_arranged','direct_charge_manual_payout',true);

-- 2) Estados y trazabilidad para pagos que llegan después de liberar una reserva.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in(
  'awaiting_payment','payment_processing','payment_review','paid','preparing_shipment',
  'shipped','delivered','inspection','completed','claim_open','return_authorized',
  'return_shipped','returned','refund_pending','refunded','cancelled'
));

create table if not exists public.payment_exceptions(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_intent_id text,
  checkout_session_id text,
  exception_type text not null check(exception_type in(
    'late_payment','dress_no_longer_available','amount_mismatch','currency_mismatch','manual_review'
  )),
  status text not null default 'open' check(status in('open','refunded','resolved')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(order_id,payment_intent_id,exception_type)
);
alter table public.payment_exceptions enable row level security;
revoke all on public.payment_exceptions from anon,authenticated;
grant select on public.payment_exceptions to authenticated;
drop policy if exists "admin reads payment exceptions" on public.payment_exceptions;
create policy "admin reads payment exceptions" on public.payment_exceptions for select to authenticated using(public.is_admin());

create table if not exists public.api_rate_limits(
  actor_key text not null, action text not null, window_started_at timestamptz not null default now(),
  request_count integer not null default 0, primary key(actor_key,action)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon,authenticated;
create or replace function public.backend_consume_rate_limit(p_actor_key text,p_action text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.api_rate_limits;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  if p_limit<1 or p_window_seconds<1 then raise exception 'Configuración inválida'; end if;
  insert into public.api_rate_limits(actor_key,action,window_started_at,request_count) values(p_actor_key,p_action,now(),1)
  on conflict(actor_key,action) do update set
    window_started_at=case when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now() then now() else public.api_rate_limits.window_started_at end,
    request_count=case when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now() then 1 else public.api_rate_limits.request_count+1 end
  returning * into r;
  return r.request_count<=p_limit;
end$$;
revoke all on function public.backend_consume_rate_limit(text,text,integer,integer) from public;

-- Una publicación no puede tener dos checkouts activos al mismo tiempo.
with ranked as(
  select id,row_number() over(partition by dress_id order by updated_at desc,created_at desc,id desc) as rn
  from public.orders where status='payment_processing'
) update public.orders set status='cancelled',payment_failure_code='duplicate_checkout_cleaned_by_0018',updated_at=now()
where id in(select id from ranked where rn>1);
create unique index if not exists orders_one_active_checkout_per_dress
on public.orders(dress_id) where status='payment_processing';

-- Ledger idempotente para los conceptos canónicos de una operación.
delete from public.payment_ledger a using public.payment_ledger b
where a.order_id=b.order_id and a.entry_type=b.entry_type
  and a.entry_type in('buyer_charge','shipping_charge','seller_commission','seller_admin_fee','processor_fee','seller_payout')
  and(a.created_at>b.created_at or(a.created_at=b.created_at and a.id>b.id));
create unique index if not exists payment_ledger_one_canonical_entry
on public.payment_ledger(order_id,entry_type)
where entry_type in('buyer_charge','shipping_charge','seller_commission','seller_admin_fee','processor_fee','seller_payout');
delete from public.payment_ledger a using public.payment_ledger b
where a.reference_type=b.reference_type and a.reference_id=b.reference_id
  and a.reference_type is not null and a.reference_id is not null
  and(a.created_at>b.created_at or(a.created_at=b.created_at and a.id>b.id));
create unique index if not exists payment_ledger_provider_reference_unique
on public.payment_ledger(reference_type,reference_id) where reference_type is not null and reference_id is not null;

alter table public.order_evidence drop constraint if exists order_evidence_type_check;
alter table public.order_evidence add constraint order_evidence_type_check check(evidence_type in(
  'seller_pre_ship','seller_packed','seller_shipping_receipt','buyer_package_received',
  'buyer_unboxing','buyer_dress_received','buyer_return_packed','seller_return_received','other'
));

-- Nuevas verificaciones se delegan a Stripe Connect; ya no se reciben copias
-- manuales de INE/pasaporte. Los registros pendientes antiguos se rechazan,
-- pero los objetos existentes NO se borran desde SQL: Supabase exige usar la
-- Storage API para evitar archivos huérfanos o pérdida accidental de datos.
revoke insert on public.identity_verifications from authenticated;
drop policy if exists "identity upload own folder" on storage.objects;
update public.identity_verifications
set status='rejected',verification_result='expired'
where status='pending' and created_at<now()-interval '30 days';

-- Sustituye la función histórica de 0011, que intentaba borrar el objeto con
-- DELETE sobre storage.objects. La ruta se conserva hasta que un proceso de
-- backend elimine el archivo mediante Storage API y confirme la depuración.
create or replace function public.admin_resolve_identity_verification(p_verification_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in('verified','rejected') then raise exception 'Estado inválido'; end if;
  select user_id into v_user
  from public.identity_verifications
  where id=p_verification_id
  for update;
  if v_user is null then raise exception 'Verificación inexistente'; end if;
  update public.identity_verifications set
    status=p_status,
    verification_result=p_status,
    reviewed_by=auth.uid(),
    reviewed_at=now()
  where id=p_verification_id;
  update public.profiles set identity_verified=(p_status='verified') where id=v_user;
end;
$$;
revoke all on function public.admin_resolve_identity_verification(uuid,text) from public;
grant execute on function public.admin_resolve_identity_verification(uuid,text) to authenticated;

-- 3) La oferta aceptada genera pedido, pero todavía no reserva el vestido.
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
  values(o.dress_id,o.id,o.buyer_id,o.seller_id,o.amount_mxn,v_commission,o.amount_mxn,o.amount_mxn-v_commission,now()+interval '24 hours')
  returning id into v_order;
  return v_order;
end$$;
revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- 4) Snapshot económico definitivo. La comisión de Stripe no se descuenta a
-- la vendedora: forma parte del 18% que retiene SECOND VOW.
create or replace function public.backend_prepare_order_financials(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders; f public.marketplace_fee_configs; v_commission integer; v_buyer_fee integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.status<>'awaiting_payment' then raise exception 'El pedido no está pendiente de pago'; end if;
  if o.payment_deadline_at is not null and o.payment_deadline_at<now() then raise exception 'El plazo para pagar venció'; end if;
  if o.shipping_quote_set_at is null then raise exception 'La vendedora debe cotizar el envío antes del pago'; end if;
  select * into f from public.marketplace_fee_configs
  where is_active=true and effective_from<=now() and(effective_until is null or effective_until>now())
  order by effective_from desc limit 1;
  if f.id is null then raise exception 'No existe configuración de tarifas activa'; end if;
  v_commission:=round(o.subtotal_mxn*f.seller_commission_bps/10000.0);
  v_buyer_fee:=round(o.subtotal_mxn*f.buyer_protection_bps/10000.0)+f.buyer_protection_fixed_mxn;
  update public.orders set
    fee_config_id=f.id,seller_commission_bps=f.seller_commission_bps,buyer_protection_bps=f.buyer_protection_bps,
    commission_mxn=v_commission,seller_admin_fee_mxn=0,buyer_protection_fee_mxn=v_buyer_fee,
    seller_net_mxn=greatest(0,o.subtotal_mxn-v_commission+o.shipping_mxn),
    seller_transfer_mxn=greatest(0,o.subtotal_mxn-v_commission+o.shipping_mxn),
    total_mxn=o.subtotal_mxn+o.shipping_mxn+v_buyer_fee,
    amount_charged_mxn=o.subtotal_mxn+o.shipping_mxn+v_buyer_fee,updated_at=now()
  where id=o.id returning * into o;
  return o;
end$$;
revoke all on function public.backend_prepare_order_financials(uuid) from public;

-- 5) Inicio de checkout: pedido y vestido se bloquean/cambian juntos.
create or replace function public.backend_begin_checkout(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders; d public.dresses;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.status<>'awaiting_payment' then raise exception 'El pedido ya no puede iniciar pago'; end if;
  if o.payment_deadline_at is not null and o.payment_deadline_at<now() then raise exception 'El plazo para pagar venció'; end if;
  select * into d from public.dresses where id=o.dress_id for update;
  if d.id is null or d.status<>'approved' then raise exception 'El vestido ya no está disponible'; end if;
  if exists(select 1 from public.orders x where x.dress_id=o.dress_id and x.id<>o.id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped')) then
    raise exception 'El vestido ya tiene una operación activa';
  end if;
  update public.orders set status='payment_processing',payment_deadline_at=now()+interval '60 minutes',stripe_checkout_session_id=null,updated_at=now() where id=o.id returning * into o;
  update public.dresses set status='reserved' where id=o.dress_id;
  return o;
end$$;
revoke all on function public.backend_begin_checkout(uuid) from public;

create or replace function public.backend_attach_checkout_session(p_order_id uuid,p_checkout_session_id text,p_transfer_group text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  if nullif(btrim(p_checkout_session_id),'') is null then raise exception 'Sesión inválida'; end if;
  update public.orders set stripe_checkout_session_id=p_checkout_session_id,stripe_transfer_group=p_transfer_group,updated_at=now()
  where id=p_order_id and status='payment_processing';
  if not found then raise exception 'El checkout ya no está activo'; end if;
end$$;
revoke all on function public.backend_attach_checkout_session(uuid,text,text) from public;

create or replace function public.backend_release_checkout(p_order_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.status<>'payment_processing' then return; end if;
  update public.orders set status='cancelled',payment_failure_code=coalesce(nullif(p_reason,''),'checkout_released'),updated_at=now() where id=o.id;
  update public.dresses set status='approved' where id=o.dress_id and status='reserved'
    and not exists(select 1 from public.orders x where x.dress_id=o.dress_id and x.id<>o.id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped'));
end$$;
revoke all on function public.backend_release_checkout(uuid,text) from public;

-- La vuelta del navegador no prueba que el pago se canceló. Esta RPC queda por
-- compatibilidad, pero solo libera cuando el plazo de Stripe ya venció.
create or replace function public.cancel_stale_checkout(p_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.buyer_id<>auth.uid() and auth.role()<>'service_role' and not public.is_admin() then raise exception 'No autorizado'; end if;
  if o.status<>'payment_processing' or o.payment_deadline_at>=now() then return; end if;
  update public.orders set status='cancelled',payment_failure_code='checkout_expired',updated_at=now() where id=o.id;
  update public.dresses set status='approved' where id=o.dress_id and status='reserved';
end$$;
revoke all on function public.cancel_stale_checkout(uuid) from public;
grant execute on function public.cancel_stale_checkout(uuid) to authenticated;

create or replace function public.backend_expire_abandoned_payments() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  with stale as(
    update public.orders set status='cancelled',payment_failure_code='checkout_expired',updated_at=now()
    where status='payment_processing' and payment_deadline_at<now()-interval '5 minutes'
    returning dress_id
  ), released as(
    update public.dresses d set status='approved' from stale s
    where d.id=s.dress_id and d.status='reserved'
      and not exists(select 1 from public.orders x where x.dress_id=d.id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped'))
    returning d.id
  ) select count(*) into v_count from stale;
  update public.orders set status='cancelled',payment_failure_code='offer_payment_window_expired',updated_at=now()
  where status='awaiting_payment' and payment_deadline_at<now();
  return v_count;
end$$;
revoke all on function public.backend_expire_abandoned_payments() from public;

create or replace function public.expire_dress_reservation_if_stale(p_dress_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where dress_id=p_dress_id and status='payment_processing'
    and payment_deadline_at<now()-interval '5 minutes' limit 1 for update skip locked;
  if v_order.id is null then return; end if;
  update public.orders set status='cancelled',payment_failure_code='checkout_expired',updated_at=now() where id=v_order.id;
  update public.dresses set status='approved' where id=p_dress_id and status='reserved'
    and not exists(select 1 from public.orders x where x.dress_id=p_dress_id and x.status in('payment_processing','payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped'));
end$$;
revoke all on function public.expire_dress_reservation_if_stale(uuid) from public;
grant execute on function public.expire_dress_reservation_if_stale(uuid) to authenticated,anon;

-- 6) Confirmación del cobro con validaciones de importe, moneda y disponibilidad.
create or replace function public.backend_mark_payment_paid(
  p_order_id uuid,p_payment_intent_id text,p_charge_id text,p_checkout_session_id text,
  p_processor_fee_mxn integer default null,p_amount_received_mxn integer default null,p_currency text default 'MXN'
) returns text language plpgsql security definer set search_path='' as $$
declare o public.orders; v_payment uuid; v_conflict boolean; v_result text:='paid';
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if upper(coalesce(p_currency,''))<>'MXN' then
    insert into public.payment_exceptions(order_id,payment_intent_id,checkout_session_id,exception_type,details)
    values(o.id,p_payment_intent_id,p_checkout_session_id,'currency_mismatch',jsonb_build_object('currency',p_currency)) on conflict do nothing;
    update public.orders set status='payment_review',updated_at=now() where id=o.id; return 'payment_review';
  end if;
  if p_amount_received_mxn is not null and p_amount_received_mxn<>coalesce(o.amount_charged_mxn,o.total_mxn) then
    insert into public.payment_exceptions(order_id,payment_intent_id,checkout_session_id,exception_type,details)
    values(o.id,p_payment_intent_id,p_checkout_session_id,'amount_mismatch',jsonb_build_object('expected',coalesce(o.amount_charged_mxn,o.total_mxn),'received',p_amount_received_mxn)) on conflict do nothing;
    update public.orders set status='payment_review',updated_at=now() where id=o.id; return 'payment_review';
  end if;
  if o.stripe_payment_intent_id=p_payment_intent_id and o.status in('paid','preparing_shipment','shipped','delivered','inspection','completed') then return 'duplicate'; end if;
  select exists(select 1 from public.orders x where x.dress_id=o.dress_id and x.id<>o.id and x.status in('payment_review','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped','completed')) into v_conflict;
  if o.status='cancelled' or v_conflict then
    insert into public.payment_exceptions(order_id,payment_intent_id,checkout_session_id,exception_type,details)
    values(o.id,p_payment_intent_id,p_checkout_session_id,case when v_conflict then 'dress_no_longer_available' else 'late_payment' end,'{}') on conflict do nothing;
    v_result:='payment_review';
  end if;
  update public.orders set status=v_result,payment_provider='stripe',payment_reference=p_payment_intent_id,
    stripe_payment_intent_id=p_payment_intent_id,stripe_charge_id=p_charge_id,stripe_checkout_session_id=p_checkout_session_id,
    processor_fee_mxn=coalesce(p_processor_fee_mxn,processor_fee_mxn),seller_net_after_processor_mxn=seller_transfer_mxn,
    paid_at=coalesce(paid_at,now()),seller_ship_by=case when v_result='paid' then coalesce(seller_ship_by,now()+interval '4 days') else seller_ship_by end,updated_at=now()
  where id=o.id;
  insert into public.payments(order_id,provider,provider_reference,status,amount_mxn,currency,provider_payment_intent_id,provider_charge_id,provider_checkout_session_id,paid_at)
  values(o.id,'stripe',p_payment_intent_id,'paid',coalesce(p_amount_received_mxn,o.amount_charged_mxn,o.total_mxn),'MXN',p_payment_intent_id,p_charge_id,p_checkout_session_id,now())
  on conflict(provider,provider_payment_intent_id) where provider_payment_intent_id is not null
  do update set status='paid',provider_charge_id=excluded.provider_charge_id,paid_at=coalesce(public.payments.paid_at,excluded.paid_at),updated_at=now()
  returning id into v_payment;
  if v_result='paid' then
    update public.dresses set status='reserved' where id=o.dress_id and status in('approved','reserved');
    insert into public.seller_payouts(order_id,seller_id,amount_mxn,status)
    values(o.id,o.seller_id,o.seller_transfer_mxn,'held') on conflict(order_id) do update set amount_mxn=excluded.amount_mxn,updated_at=now();
  end if;
  insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id)
  values(o.id,'buyer_charge',coalesce(p_amount_received_mxn,o.amount_charged_mxn,o.total_mxn),'payment_intent',p_payment_intent_id) on conflict do nothing;
  insert into public.payment_ledger(order_id,entry_type,amount_mxn)
  values(o.id,'seller_commission',o.commission_mxn),(o.id,'seller_admin_fee',0),(o.id,'shipping_charge',o.shipping_mxn) on conflict do nothing;
  if p_processor_fee_mxn is not null then insert into public.payment_ledger(order_id,entry_type,amount_mxn) values(o.id,'processor_fee',p_processor_fee_mxn) on conflict do nothing; end if;
  return v_result;
end$$;
revoke all on function public.backend_mark_payment_paid(uuid,text,text,text,integer,integer,text) from public;

create or replace function public.backend_mark_checkout_failed(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  perform public.backend_release_checkout(p_order_id,coalesce(nullif(p_reason,''),'payment_failed'));
end$$;
revoke all on function public.backend_mark_checkout_failed(uuid,text) from public;

create or replace function public.backend_record_refund(
  p_order_id uuid,p_provider_refund_id text,p_amount_mxn integer,p_status text,p_reason_code text default 'other'
) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; v_payment uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  if p_amount_mxn is null or p_amount_mxn<=0 then raise exception 'Importe de reembolso inválido'; end if;
  if p_status not in('pending','processing','succeeded','failed','cancelled') then raise exception 'Estado inválido'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  select id into v_payment from public.payments where order_id=o.id and status in('paid','partially_refunded','refunded') order by created_at desc limit 1;
  insert into public.refunds(order_id,payment_id,provider,provider_refund_id,amount_mxn,reason_code,status,completed_at)
  values(o.id,v_payment,'stripe',p_provider_refund_id,p_amount_mxn,p_reason_code,p_status,case when p_status='succeeded' then now() else null end)
  on conflict(provider_refund_id) do update set status=excluded.status,completed_at=case when excluded.status='succeeded' then coalesce(public.refunds.completed_at,now()) else public.refunds.completed_at end;
  if p_status='succeeded' then
    update public.payments set status=case when p_amount_mxn>=amount_mxn then 'refunded' else 'partially_refunded' end,updated_at=now() where id=v_payment;
    update public.orders set status=case when p_amount_mxn>=coalesce(amount_charged_mxn,total_mxn) then 'refunded' else status end,updated_at=now() where id=o.id;
    if p_amount_mxn>=coalesce(o.amount_charged_mxn,o.total_mxn) then
      update public.dresses set status='archived' where id=o.dress_id and status in('reserved','sold');
    end if;
    update public.seller_payouts set status=case when status in('held','releasable','requested') then 'reversed' else status end,updated_at=now() where order_id=o.id;
    update public.claims set status='refunded',refund_amount_mxn=p_amount_mxn,resolved_at=coalesce(resolved_at,now())
    where order_id=o.id and status in('returned','refund_pending');
    insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id)
    values(o.id,'refund',-p_amount_mxn,'stripe_refund',p_provider_refund_id) on conflict do nothing;
  end if;
end$$;
revoke all on function public.backend_record_refund(uuid,text,integer,text,text) from public;

create or replace function public.backend_mark_payment_dispute(p_payment_intent_id text,p_dispute_id text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where stripe_payment_intent_id=p_payment_intent_id for update;
  if o.id is null then return; end if;
  insert into public.payment_exceptions(order_id,payment_intent_id,exception_type,details,status,resolved_at)
  values(o.id,p_payment_intent_id,'manual_review',jsonb_build_object('dispute_id',p_dispute_id,'dispute_status',p_status),case when p_status in('won','lost') then 'resolved' else 'open' end,case when p_status in('won','lost') then now() else null end)
  on conflict(order_id,payment_intent_id,exception_type) do update set details=excluded.details,status=excluded.status,resolved_at=excluded.resolved_at;
  if p_status not in('won') then
    update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in('held','releasable','requested');
  end if;
end$$;
revoke all on function public.backend_mark_payment_dispute(text,text,text) from public;

-- Reintento seguro: si Stripe falló después de crear la transferencia, se
-- conserva transfer_id y solo se vuelve a intentar el payout bancario.
create or replace function public.request_seller_payout(p_order_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.seller_payouts; a public.seller_payment_accounts;
begin
  select * into p from public.seller_payouts where order_id=p_order_id for update;
  if p.id is null or p.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if p.status not in('releasable','failed') then raise exception 'El saldo todavía no está disponible para retiro'; end if;
  select * into a from public.seller_payment_accounts where user_id=auth.uid();
  if a.user_id is null or a.onboarding_status<>'complete' or not a.payouts_enabled or not a.bank_account_linked then raise exception 'Primero vincula y verifica tu cuenta bancaria'; end if;
  update public.seller_payouts set status='requested',requested_at=coalesce(requested_at,now()),connected_account_id=a.provider_account_id,failure_code=null,updated_at=now()
  where id=p.id returning * into p;
  return p.id;
end$$;
revoke all on function public.request_seller_payout(uuid) from public;
grant execute on function public.request_seller_payout(uuid) to authenticated;

create or replace function public.register_return_shipment(p_order_id uuid,p_carrier text,p_tracking_number text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; c public.claims;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado'; end if;
  select * into c from public.claims where order_id=o.id and status='approved_return' order by created_at desc limit 1 for update;
  if c.id is null then raise exception 'La devolución no está autorizada'; end if;
  if c.return_shipping_deadline_at is null or now()>c.return_shipping_deadline_at then raise exception 'El plazo para enviar la devolución venció'; end if;
  if nullif(btrim(p_carrier),'') is null or nullif(btrim(p_tracking_number),'') is null then raise exception 'Paquetería y guía son obligatorias'; end if;
  insert into public.shipments(order_id,direction,carrier,tracking_number,status,shipped_at)
  values(o.id,'return',btrim(p_carrier),btrim(p_tracking_number),'in_transit',now())
  on conflict(order_id) where direction='return' do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,now()),updated_at=now();
  update public.claims set status='return_shipped',return_shipped_at=now(),return_tracking_number=btrim(p_tracking_number) where id=c.id;
  update public.orders set status='return_shipped',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'return_shipped',jsonb_build_object('carrier',btrim(p_carrier),'tracking_number',btrim(p_tracking_number)));
end$$;
revoke all on function public.register_return_shipment(uuid,text,text) from public;
grant execute on function public.register_return_shipment(uuid,text,text) to authenticated;

create or replace function public.confirm_return_received(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; c public.claims;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
  select * into c from public.claims where order_id=o.id and status='return_shipped' order by created_at desc limit 1 for update;
  if c.id is null then raise exception 'No existe devolución en tránsito'; end if;
  update public.shipments set status='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now() where order_id=o.id and direction='return';
  update public.claims set status='refund_pending',return_delivered_at=coalesce(return_delivered_at,now()) where id=c.id;
  update public.orders set status='returned',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type) values(o.id,auth.uid(),'return_received');
end$$;
revoke all on function public.confirm_return_received(uuid) from public;
grant execute on function public.confirm_return_received(uuid) to authenticated;

commit;
