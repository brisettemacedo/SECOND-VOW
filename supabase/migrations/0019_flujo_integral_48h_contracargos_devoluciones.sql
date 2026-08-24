-- SECOND VOW 0019 — flujo integral 48h, contracargos, devoluciones rastreables
-- Ejecutar una sola vez después de 0018. No elimina objetos de Supabase Storage.
begin;

create extension if not exists pgcrypto with schema extensions;

-- Excepciones de pago y bloqueos operativos de servidor.
alter table public.orders add column if not exists shipping_blocked_at timestamptz;
alter table public.orders add column if not exists shipping_block_reason text;
alter table public.orders add column if not exists stripe_dispute_id text;
alter table public.orders add column if not exists stripe_dispute_status text;
alter table public.orders add column if not exists stripe_dispute_reason text;
alter table public.orders add column if not exists stripe_dispute_due_by timestamptz;
alter table public.orders add column if not exists early_fraud_warning_at timestamptz;
alter table public.orders add column if not exists payment_review_closed_at timestamptz;
alter table public.orders add column if not exists platform_delivery_recorded_at timestamptz;
alter table public.orders add column if not exists checkout_terms_version text;
alter table public.orders add column if not exists checkout_terms_accepted_at timestamptz;
alter table public.orders add column if not exists checkout_charge_acknowledged_at timestamptz;
alter table public.orders add column if not exists shipping_insurance_required boolean not null default false;
alter table public.orders add column if not exists shipping_signature_required boolean not null default false;
alter table public.orders add column if not exists shipping_insurance_confirmed boolean not null default false;
alter table public.orders add column if not exists shipping_signature_confirmed boolean not null default false;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in(
  'awaiting_payment','payment_processing','payment_review','chargeback_open','paid','preparing_shipment',
  'shipped','delivered','inspection','completed','claim_open','return_authorized','return_shipped',
  'returned','refund_pending','refunded','cancelled'
));

-- Avisos persistentes; el correo/SMS puede consumir esta outbox sin acoplar la transacción.
create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  email_status text not null default 'pending' check(email_status in('pending','sent','failed','not_required')),
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_created on public.notifications(user_id,created_at desc);
create unique index if not exists notifications_once_per_order_kind_user on public.notifications(order_id,user_id,kind) where order_id is not null;
alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.notifications from anon,authenticated;
grant select,update on public.notifications to authenticated;

-- Copia inalterable de la operación. No tiene FK con borrado en cascada para
-- que sobreviva a la edición o eliminación posterior de la publicación.
create table if not exists public.transaction_snapshots(
  order_id uuid primary key,
  buyer_id uuid not null,
  seller_id uuid not null,
  snapshot jsonb not null,
  sha256 text not null,
  captured_at timestamptz not null default now()
);
alter table public.transaction_snapshots enable row level security;
drop policy if exists "parties read transaction snapshot" on public.transaction_snapshots;
create policy "parties read transaction snapshot" on public.transaction_snapshots for select to authenticated using(auth.uid() in(buyer_id,seller_id) or public.is_admin());
revoke all on public.transaction_snapshots from anon,authenticated;
grant select on public.transaction_snapshots to authenticated;

-- Aceptaciones transaccionales separadas de la aceptación general de cuenta.
alter table public.legal_acceptances drop constraint if exists legal_acceptances_document_type_check;
alter table public.legal_acceptances add constraint legal_acceptances_document_type_check check(document_type in(
  'privacy','terms','data_processing','buyer_checkout','seller_shipping','return_policy','cookie_preferences'
));

create or replace function public.accept_order_checkout_terms(p_order_id uuid,p_terms_version text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.status not in('awaiting_payment','payment_processing') then raise exception 'El pedido ya no admite aceptación de pago'; end if;
  if nullif(btrim(p_terms_version),'') is null then raise exception 'Versión legal inválida'; end if;
  update public.orders set checkout_terms_version=btrim(p_terms_version),checkout_terms_accepted_at=now(),
    checkout_charge_acknowledged_at=now(),updated_at=now() where id=o.id;
  insert into public.legal_acceptances(user_id,document_type,document_version,source)
  values(auth.uid(),'buyer_checkout',btrim(p_terms_version),'order_checkout') on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,auth.uid(),'checkout_terms_accepted',jsonb_build_object('version',btrim(p_terms_version)));
end$$;
revoke all on function public.accept_order_checkout_terms(uuid,text) from public;
grant execute on function public.accept_order_checkout_terms(uuid,text) to authenticated;

-- El pago fija cinco días naturales y exige aceptación específica del checkout.
create or replace function public.backend_mark_payment_paid(
  p_order_id uuid,p_payment_intent_id text,p_charge_id text,p_checkout_session_id text,
  p_processor_fee_mxn integer default null,p_amount_received_mxn integer default null,p_currency text default 'MXN'
) returns text language plpgsql security definer set search_path='' as $$
declare o public.orders; v_payment uuid; v_conflict boolean; v_result text:='paid';
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.checkout_terms_accepted_at is null or o.checkout_charge_acknowledged_at is null then raise exception 'Falta aceptación transaccional de la compradora'; end if;
  if upper(coalesce(p_currency,''))<>'MXN' then v_result:='payment_review'; end if;
  if p_amount_received_mxn is not null and p_amount_received_mxn<>coalesce(o.amount_charged_mxn,o.total_mxn) then v_result:='payment_review'; end if;
  if o.stripe_payment_intent_id=p_payment_intent_id and o.status in('paid','preparing_shipment','shipped','delivered','inspection','completed') then return 'duplicate'; end if;
  select exists(select 1 from public.orders x where x.dress_id=o.dress_id and x.id<>o.id and x.status in('payment_review','chargeback_open','paid','preparing_shipment','shipped','delivered','inspection','claim_open','return_authorized','return_shipped','completed')) into v_conflict;
  if o.status='cancelled' or v_conflict then v_result:='payment_review'; end if;
  if v_result='payment_review' then
    insert into public.payment_exceptions(order_id,payment_intent_id,checkout_session_id,exception_type,details)
    values(o.id,p_payment_intent_id,p_checkout_session_id,'manual_review',jsonb_build_object('currency',p_currency,'received',p_amount_received_mxn,'expected',coalesce(o.amount_charged_mxn,o.total_mxn),'conflict',v_conflict)) on conflict do nothing;
  end if;
  update public.orders set status=v_result,payment_provider='stripe',payment_reference=p_payment_intent_id,
    stripe_payment_intent_id=p_payment_intent_id,stripe_charge_id=p_charge_id,stripe_checkout_session_id=p_checkout_session_id,
    processor_fee_mxn=coalesce(p_processor_fee_mxn,processor_fee_mxn),seller_net_after_processor_mxn=seller_transfer_mxn,
    paid_at=coalesce(paid_at,now()),seller_ship_by=case when v_result='paid' then coalesce(seller_ship_by,now()+interval '5 days') else seller_ship_by end,
    shipping_insurance_required=subtotal_mxn>=10000,shipping_signature_required=subtotal_mxn>=10000,
    shipping_blocked_at=case when v_result='payment_review' then now() else null end,
    shipping_block_reason=case when v_result='payment_review' then 'payment_review' else null end,updated_at=now()
  where id=o.id;
  insert into public.transaction_snapshots(order_id,buyer_id,seller_id,snapshot,sha256)
  select o.id,o.buyer_id,o.seller_id,x.payload,encode(extensions.digest(x.payload::text,'sha256'),'hex')
  from lateral(select jsonb_build_object(
    'order',(select to_jsonb(z) from public.orders z where z.id=o.id),
    'dress',(select to_jsonb(d) from public.dresses d where d.id=o.dress_id),
    'photos',coalesce((select jsonb_agg(to_jsonb(dp) order by dp.position) from public.dress_photos dp where dp.dress_id=o.dress_id),'[]'::jsonb),
    'declaration',(select to_jsonb(dd) from public.dress_declarations dd where dd.dress_id=o.dress_id),
    'shipping_address',(select to_jsonb(a) from public.order_shipping_addresses a where a.order_id=o.id)
  ) payload)x on conflict(order_id) do nothing;
  insert into public.payments(order_id,provider,provider_reference,status,amount_mxn,currency,provider_payment_intent_id,provider_charge_id,provider_checkout_session_id,paid_at)
  values(o.id,'stripe',p_payment_intent_id,'paid',coalesce(p_amount_received_mxn,o.amount_charged_mxn,o.total_mxn),'MXN',p_payment_intent_id,p_charge_id,p_checkout_session_id,now())
  on conflict(provider,provider_payment_intent_id) where provider_payment_intent_id is not null do update set status='paid',provider_charge_id=excluded.provider_charge_id,paid_at=coalesce(public.payments.paid_at,excluded.paid_at),updated_at=now() returning id into v_payment;
  if v_result='paid' then
    update public.dresses set status='reserved' where id=o.dress_id and status in('approved','reserved');
    insert into public.seller_payouts(order_id,seller_id,amount_mxn,status) values(o.id,o.seller_id,o.seller_transfer_mxn,'held') on conflict(order_id) do update set amount_mxn=excluded.amount_mxn,updated_at=now();
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.seller_id,o.id,'payment_confirmed','Pago confirmado','Tienes cinco días naturales para registrar un envío rastreable. No envíes si el pedido muestra Pago en revisión o Envío bloqueado.') on conflict do nothing;
  end if;
  insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id) values(o.id,'buyer_charge',coalesce(p_amount_received_mxn,o.amount_charged_mxn,o.total_mxn),'payment_intent',p_payment_intent_id) on conflict do nothing;
  insert into public.payment_ledger(order_id,entry_type,amount_mxn) values(o.id,'seller_commission',o.commission_mxn),(o.id,'seller_admin_fee',0),(o.id,'shipping_charge',o.shipping_mxn) on conflict do nothing;
  if p_processor_fee_mxn is not null then insert into public.payment_ledger(order_id,entry_type,amount_mxn) values(o.id,'processor_fee',p_processor_fee_mxn) on conflict do nothing; end if;
  return v_result;
end$$;
revoke all on function public.backend_mark_payment_paid(uuid,text,text,text,integer,integer,text) from public;

-- Registrar envío: bloqueo duro, plazo, rastreo y seguro/firma para alto valor.
create or replace function public.mark_order_shipped(p_order_id uuid,p_carrier text,p_tracking_number text,p_insured boolean default false,p_signature boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; v_shipment uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.status not in('paid','preparing_shipment') or o.shipping_blocked_at is not null then raise exception 'Envío bloqueado: el pago está en revisión'; end if;
  if o.seller_ship_by is not null and now()>o.seller_ship_by then raise exception 'El plazo de cinco días naturales venció'; end if;
  if nullif(btrim(p_carrier),'') is null or nullif(btrim(p_tracking_number),'') is null then raise exception 'Paquetería y guía rastreable son obligatorias'; end if;
  if o.subtotal_mxn>=10000 and(not p_insured or not p_signature) then raise exception 'Para vestidos de $10,000 MXN o más se exige seguro y firma de recepción'; end if;
  insert into public.shipments(order_id,direction,carrier,tracking_number,status,shipped_at)
  values(o.id,'outbound',btrim(p_carrier),btrim(p_tracking_number),'in_transit',now())
  on conflict(order_id) where direction='outbound' do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,now()),updated_at=now() returning id into v_shipment;
  update public.orders set status='shipped',carrier=btrim(p_carrier),tracking_number=btrim(p_tracking_number),shipped_at=now(),
    shipping_insurance_confirmed=p_insured,shipping_signature_confirmed=p_signature,updated_at=now() where id=o.id;
  insert into public.legal_acceptances(user_id,document_type,document_version,source) values(auth.uid(),'seller_shipping','2026-08-22','order_shipping') on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'shipped',jsonb_build_object('shipment_id',v_shipment,'carrier',btrim(p_carrier),'tracking',btrim(p_tracking_number),'insured',p_insured,'signature',p_signature));
end$$;
revoke all on function public.mark_order_shipped(uuid,text,text,boolean,boolean) from public;
grant execute on function public.mark_order_shipped(uuid,text,text,boolean,boolean) to authenticated;
-- La firma histórica de tres argumentos se revoca para que no pueda omitir
-- bloqueo, plazo, seguro o firma mediante una llamada directa a la RPC.
revoke all on function public.mark_order_shipped(uuid,text,text) from public;

-- Ship24: la ventana inicia cuando SECOND VOW recibe por primera vez el evento delivered,
-- no retroactivamente en la fecha histórica informada por la paquetería.
create or replace function public.backend_process_tracking_event(p_provider text,p_tracker_id text,p_provider_event_id text,p_status_milestone text,p_status_code text,p_raw_status text,p_occurred_at timestamptz,p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s public.shipments; o public.orders; v_rows integer:=0; v_received timestamptz:=now();
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into s from public.shipments where tracking_provider=p_provider and tracking_provider_id=p_tracker_id for update;
  if s.id is null then raise exception 'Tracker desconocido'; end if;
  insert into public.tracking_events(shipment_id,provider,provider_event_id,status_milestone,status_code,raw_status,occurred_at,payload)
  values(s.id,p_provider,p_provider_event_id,p_status_milestone,p_status_code,p_raw_status,p_occurred_at,coalesce(p_payload,'{}'::jsonb)) on conflict(provider,provider_event_id) do nothing;
  get diagnostics v_rows=row_count; if v_rows=0 then return; end if;
  update public.shipments set tracking_provider_status=p_status_milestone,tracking_provider_event_id=p_provider_event_id,
    last_tracking_event_at=greatest(coalesce(last_tracking_event_at,p_occurred_at),p_occurred_at),
    status=case when p_status_milestone='delivered' then 'delivered' when p_status_milestone='exception' then 'exception' when p_status_milestone in('in_transit','out_for_delivery','failed_attempt','available_for_pickup') then 'in_transit' else status end,
    carrier_delivered_at=case when p_status_milestone='delivered' then coalesce(carrier_delivered_at,p_occurred_at) else carrier_delivered_at end,updated_at=now() where id=s.id;
  if p_status_milestone='delivered' then
    select * into o from public.orders where id=s.order_id for update;
    if s.direction='return' then
      update public.claims set status='refund_pending',return_delivered_at=coalesce(return_delivered_at,v_received) where order_id=o.id and status='return_shipped';
      update public.orders set status='returned',updated_at=now() where id=o.id and status='return_shipped';
      insert into public.notifications(user_id,order_id,kind,title,body) values(o.buyer_id,o.id,'return_delivered','Devolución entregada','El seguimiento acreditó la entrega de la devolución. El reembolso pasa a validación administrativa.') on conflict do nothing;
    elsif o.platform_delivery_recorded_at is null then
      update public.orders set carrier_delivered_at=coalesce(carrier_delivered_at,p_occurred_at),platform_delivery_recorded_at=v_received,
        delivered_at=v_received,delivery_source='carrier',inspection_deadline_at=v_received+interval '48 hours',dispute_deadline_at=v_received+interval '48 hours',
        claim_deadline_at=v_received+interval '48 hours',payout_release_at=v_received+interval '48 hours',status=case when status in('shipped','delivered') then 'inspection' else status end,updated_at=now() where id=o.id;
      insert into public.notifications(user_id,order_id,kind,title,body) values(o.buyer_id,o.id,'delivery_recorded','Entrega registrada','SECOND VOW recibió la confirmación de entrega. Tienes 48 horas para reclamar únicamente información falsa o materialmente incorrecta.') on conflict do nothing;
      insert into public.order_events(order_id,event_type,metadata) values(o.id,'carrier_delivered',jsonb_build_object('provider',p_provider,'event_id',p_provider_event_id,'carrier_occurred_at',p_occurred_at,'platform_received_at',v_received));
    end if;
  end if;
end$$;
revoke all on function public.backend_process_tracking_event(text,text,text,text,text,text,timestamptz,jsonb) from public;

create or replace function public.confirm_order_delivered(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; v_at timestamptz:=now();
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or(o.buyer_id<>auth.uid() and auth.role()<>'service_role' and not public.is_admin()) then raise exception 'No autorizado'; end if;
  if o.status not in('shipped','delivered','inspection') then raise exception 'Estado incompatible'; end if;
  if o.platform_delivery_recorded_at is null then
    update public.orders set status='inspection',platform_delivery_recorded_at=v_at,delivered_at=v_at,delivery_source='buyer',
      inspection_deadline_at=v_at+interval '48 hours',dispute_deadline_at=v_at+interval '48 hours',claim_deadline_at=v_at+interval '48 hours',payout_release_at=v_at+interval '48 hours',updated_at=now() where id=o.id;
    update public.shipments set status='delivered',delivered_at=coalesce(delivered_at,v_at),updated_at=now() where order_id=o.id and direction='outbound';
    insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,case when auth.role()='service_role' then null else auth.uid() end,'delivery_confirmed',jsonb_build_object('platform_received_at',v_at));
  end if;
end$$;
revoke all on function public.confirm_order_delivered(uuid) from public;
grant execute on function public.confirm_order_delivered(uuid) to authenticated;

-- Solo información falsa o materialmente incorrecta; el ajuste subjetivo nunca procede.
alter table public.claims drop constraint if exists claims_reason_code_check;
alter table public.claims add constraint claims_reason_code_check check(reason_code is null or reason_code in('false_or_materially_incorrect','damaged_undisclosed'));
create or replace function public.open_order_claim(p_order_id uuid,p_reason_code text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; v_claim uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.platform_delivery_recorded_at is null then raise exception 'La entrega todavía no ha sido registrada por SECOND VOW'; end if;
  if now()>coalesce(o.dispute_deadline_at,o.platform_delivery_recorded_at+interval '48 hours') then raise exception 'El plazo de 48 horas venció y operó la aceptación automática'; end if;
  if p_reason_code not in('false_or_materially_incorrect','damaged_undisclosed') then raise exception 'La devolución solo procede por información falsa o materialmente incorrecta, incluido daño relevante no informado'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'Describe concretamente la información falsa o incorrecta'; end if;
  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'Ya existe una reclamación activa'; end if;
  insert into public.claims(order_id,opened_by,reason,reason_code,description,status) values(o.id,auth.uid(),p_reason_code,p_reason_code,btrim(p_description),'open') returning id into v_claim;
  update public.orders set status='claim_open',updated_at=now() where id=o.id;
  update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in('held','releasable','requested');
  insert into public.notifications(user_id,order_id,kind,title,body) values(o.seller_id,o.id,'claim_opened','Reclamación abierta','El saldo permanece bloqueado mientras se revisa la reclamación y su evidencia.') on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'claim_opened',jsonb_build_object('claim_id',v_claim,'reason',p_reason_code));
  return v_claim;
end$$;
revoke all on function public.open_order_claim(uuid,text,text) from public;
grant execute on function public.open_order_claim(uuid,text,text) to authenticated;

-- Contracargos y señales tempranas: bloquean envío y retiro de inmediato.
create or replace function public.backend_mark_payment_risk(p_payment_intent_id text,p_kind text,p_reference_id text,p_status text,p_reason text default null,p_due_by timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where stripe_payment_intent_id=p_payment_intent_id for update;
  if o.id is null then return; end if;
  if p_kind='dispute' and p_status='won' then
    update public.orders set stripe_dispute_id=p_reference_id,stripe_dispute_status=p_status,payment_review_closed_at=now(),shipping_blocked_at=null,shipping_block_reason=null,
      status=case when status='chargeback_open' and shipped_at is null then 'paid' when status='chargeback_open' then 'shipped' else status end,
      seller_ship_by=case when shipped_at is null then now()+interval '5 days' else seller_ship_by end,updated_at=now() where id=o.id;
    update public.seller_payouts set status=case when status='paused' then 'held' else status end,updated_at=now() where order_id=o.id;
    insert into public.notifications(user_id,order_id,kind,title,body) values(o.seller_id,o.id,'payment_review_won','Pago habilitado','La revisión terminó favorablemente. Si aún no enviaste, tienes un nuevo plazo de cinco días naturales.') on conflict do nothing;
  else
    update public.orders set status=case when p_kind='dispute' then 'chargeback_open' else 'payment_review' end,
      shipping_blocked_at=coalesce(shipping_blocked_at,now()),shipping_block_reason=p_kind,stripe_dispute_id=case when p_kind='dispute' then p_reference_id else stripe_dispute_id end,
      stripe_dispute_status=case when p_kind='dispute' then p_status else stripe_dispute_status end,stripe_dispute_reason=coalesce(p_reason,stripe_dispute_reason),stripe_dispute_due_by=coalesce(p_due_by,stripe_dispute_due_by),
      early_fraud_warning_at=case when p_kind='early_fraud_warning' then coalesce(early_fraud_warning_at,now()) else early_fraud_warning_at end,updated_at=now() where id=o.id;
    update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in('held','releasable','requested');
    insert into public.notifications(user_id,order_id,kind,title,body,metadata) values(o.seller_id,o.id,'shipping_blocked','NO ENVÍES: pago en revisión','El pago fue desconocido o marcado como riesgoso. El registro de guía y el retiro están bloqueados hasta nueva resolución.',jsonb_build_object('kind',p_kind,'reference',p_reference_id,'status',p_status)) on conflict do nothing;
  end if;
  insert into public.order_events(order_id,event_type,metadata) values(o.id,'payment_risk',jsonb_build_object('kind',p_kind,'reference',p_reference_id,'status',p_status,'reason',p_reason,'due_by',p_due_by));
end$$;
revoke all on function public.backend_mark_payment_risk(text,text,text,text,text,timestamptz) from public;

-- Compatibilidad con el webhook anterior.
create or replace function public.backend_mark_payment_dispute(p_payment_intent_id text,p_dispute_id text,p_status text)
returns void language plpgsql security definer set search_path='' as $$ begin perform public.backend_mark_payment_risk(p_payment_intent_id,'dispute',p_dispute_id,p_status); end$$;
revoke all on function public.backend_mark_payment_dispute(text,text,text) from public;

-- Cierre diario Hobby: aceptación automática 48h, recordatorios y falta de envío.
create or replace function public.backend_finalize_expired_inspections()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  insert into public.notifications(user_id,order_id,kind,title,body)
  select seller_id,id,'shipping_due_48h','Faltan 48 horas para enviar','Registra una guía rastreable antes del vencimiento.' from public.orders where status in('paid','preparing_shipment') and shipping_blocked_at is null and seller_ship_by between now() and now()+interval '48 hours' on conflict do nothing;
  insert into public.notifications(user_id,order_id,kind,title,body)
  select seller_id,id,'shipping_due_24h','Faltan 24 horas para enviar','Registra una guía rastreable antes del vencimiento.' from public.orders where status in('paid','preparing_shipment') and shipping_blocked_at is null and seller_ship_by between now() and now()+interval '24 hours' on conflict do nothing;
  update public.orders set status='refund_pending',shipping_blocked_at=coalesce(shipping_blocked_at,now()),shipping_block_reason='shipping_deadline_expired',updated_at=now()
  where status in('paid','preparing_shipment') and shipped_at is null and seller_ship_by<now();
  insert into public.notifications(user_id,order_id,kind,title,body)
  select seller_id,id,'shipping_expired','Plazo de envío vencido','La operación fue cancelada operativamente y el reembolso completo debe enviarse a Stripe.' from public.orders where status='refund_pending' and shipping_block_reason='shipping_deadline_expired' on conflict do nothing;
  with finished as(
    update public.orders o set status='completed',accepted_by_buyer_at=coalesce(accepted_by_buyer_at,now()),completed_at=coalesce(completed_at,now()),updated_at=now()
    where o.status='inspection' and coalesce(o.dispute_deadline_at,o.platform_delivery_recorded_at+interval '48 hours')<=now()
      and o.shipping_blocked_at is null and not exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded'))
    returning o.id,o.dress_id,o.seller_id
  ), released as(
    update public.seller_payouts p set status='releasable',releasable_at=coalesce(releasable_at,now()),updated_at=now()
    where p.status='held' and exists(select 1 from finished f where f.id=p.order_id) returning p.id
  ) select count(*) into v_count from finished;
  update public.dresses d set status='sold' where exists(select 1 from public.orders o where o.dress_id=d.id and o.status='completed');
  return v_count;
end$$;
revoke all on function public.backend_finalize_expired_inspections() from public;

-- Una transferencia no puede solicitarse con alerta, contracargo o reclamación.
create or replace function public.request_seller_payout(p_order_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.seller_payouts; a public.seller_payment_accounts; o public.orders;
begin
  select * into p from public.seller_payouts where order_id=p_order_id for update;
  select * into o from public.orders where id=p_order_id for update;
  if p.id is null or p.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.status<>'completed' or o.shipping_blocked_at is not null or(o.stripe_dispute_status is not null and o.stripe_dispute_status<>'won') or exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'El saldo está bloqueado por una revisión, reclamación o contracargo'; end if;
  if p.status not in('releasable','failed') then raise exception 'El saldo todavía no está disponible para retiro'; end if;
  select * into a from public.seller_payment_accounts where user_id=auth.uid();
  if a.user_id is null or a.onboarding_status<>'complete' or not a.payouts_enabled or not a.bank_account_linked then raise exception 'Primero vincula y verifica tu cuenta bancaria'; end if;
  update public.seller_payouts set status='requested',requested_at=coalesce(requested_at,now()),connected_account_id=a.provider_account_id,failure_code=null,updated_at=now() where id=p.id returning * into p;
  return p.id;
end$$;
revoke all on function public.request_seller_payout(uuid) from public;
grant execute on function public.request_seller_payout(uuid) to authenticated;

-- Tras un reembolso por falta de envío, el vestido vuelve a catálogo. Se hace
-- con trigger porque la confirmación definitiva puede llegar por webhook.
create or replace function public.republish_after_unshipped_refund()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='refunded' and old.status is distinct from 'refunded' and new.shipping_block_reason='shipping_deadline_expired' and new.shipped_at is null then
    update public.dresses set status='approved' where id=new.dress_id and status in('reserved','archived');
    insert into public.notifications(user_id,order_id,kind,title,body) values(new.buyer_id,new.id,'refund_confirmed','Reembolso confirmado','Stripe confirmó el reembolso al medio de pago original.') on conflict do nothing;
    insert into public.notifications(user_id,order_id,kind,title,body) values(new.seller_id,new.id,'order_cancelled_no_shipping','Operación cancelada','El plazo de envío venció y el reembolso fue confirmado. El vestido volvió a publicarse.') on conflict do nothing;
  end if;
  return new;
end$$;
drop trigger if exists trg_republish_after_unshipped_refund on public.orders;
create trigger trg_republish_after_unshipped_refund after update of status on public.orders for each row execute function public.republish_after_unshipped_refund();

-- Registro idempotente del reembolso. A diferencia de 0018, una cancelación
-- por falta de envío vuelve a publicar el vestido en vez de archivarlo.
create or replace function public.backend_record_refund(p_order_id uuid,p_provider_refund_id text,p_amount_mxn integer,p_status text,p_reason_code text default 'other')
returns void language plpgsql security definer set search_path='' as $$
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
      update public.dresses set status=case when o.shipping_block_reason='shipping_deadline_expired' and o.shipped_at is null then 'approved' else 'archived' end where id=o.dress_id and status in('reserved','sold','archived','approved');
    end if;
    update public.seller_payouts set status=case when status in('held','releasable','requested','paused') then 'reversed' else status end,updated_at=now() where order_id=o.id;
    update public.claims set status='refunded',refund_amount_mxn=p_amount_mxn,resolved_at=coalesce(resolved_at,now()) where order_id=o.id and status in('returned','refund_pending');
    insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id) values(o.id,'refund',-p_amount_mxn,'stripe_refund',p_provider_refund_id) on conflict do nothing;
  end if;
end$$;
revoke all on function public.backend_record_refund(uuid,text,integer,text,text) from public;

commit;
