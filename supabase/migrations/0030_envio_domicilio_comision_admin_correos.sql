-- SECOND VOW 0030 — destino de envío, comisión configurable, evidencia,
-- operación administrativa y bitácora de correo.
-- Ejecutar DESPUÉS de 0029.
begin;

-- 1. Destino privado compartido únicamente entre las partes de la conversación.
alter table public.conversations add column if not exists shipping_destination_type text;
alter table public.conversations add column if not exists recipient_full_name text;
alter table public.conversations add column if not exists recipient_phone text;
alter table public.conversations add column if not exists shipping_street1 text;
alter table public.conversations add column if not exists shipping_street2 text;
alter table public.conversations add column if not exists shipping_neighborhood text;
alter table public.conversations add column if not exists shipping_city text;
alter table public.conversations add column if not exists shipping_state text;
alter table public.conversations add column if not exists shipping_branch_name text;
alter table public.conversations add column if not exists shipping_destination_set_at timestamptz;
alter table public.conversations drop constraint if exists conversations_shipping_destination_type_check;
alter table public.conversations add constraint conversations_shipping_destination_type_check
  check (shipping_destination_type is null or shipping_destination_type in ('home','carrier_branch'));

create or replace function public.set_conversation_shipping_destination(
  p_conversation_id uuid,
  p_destination_type text,
  p_recipient_full_name text,
  p_recipient_phone text,
  p_street1 text,
  p_street2 text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_branch_name text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversations; v_postal text := regexp_replace(coalesce(p_postal_code,''),'[^0-9]','','g');
begin
  select * into c from public.conversations where id=p_conversation_id for update;
  if c.id is null or c.buyer_id<>(select auth.uid()) then raise exception 'Solo la compradora puede registrar el destino'; end if;
  if exists(select 1 from public.orders where dress_id=c.dress_id and buyer_id=c.buyer_id and status not in('cancelled','refunded')) then
    raise exception 'El destino ya no puede modificarse después de aceptar una oferta';
  end if;
  if p_destination_type not in('home','carrier_branch') then raise exception 'Selecciona domicilio o sucursal de paquetería'; end if;
  if char_length(btrim(coalesce(p_recipient_full_name,'')))<5 then raise exception 'Escribe el nombre completo de quien recibirá'; end if;
  if char_length(regexp_replace(coalesce(p_recipient_phone,''),'[^0-9]','','g'))<10 then raise exception 'Escribe un teléfono válido'; end if;
  if v_postal !~ '^[0-9]{5}$' then raise exception 'Ingresa un código postal de 5 dígitos'; end if;
  if nullif(btrim(coalesce(p_street1,'')),'') is null or nullif(btrim(coalesce(p_city,'')),'') is null or nullif(btrim(coalesce(p_state,'')),'') is null then
    raise exception 'Completa la dirección del destino';
  end if;
  if p_destination_type='carrier_branch' and nullif(btrim(coalesce(p_branch_name,'')),'') is null then raise exception 'Indica la paquetería o sucursal'; end if;
  update public.conversations set
    shipping_destination_type=p_destination_type,
    recipient_full_name=btrim(p_recipient_full_name), recipient_phone=btrim(p_recipient_phone),
    shipping_street1=btrim(p_street1), shipping_street2=nullif(btrim(coalesce(p_street2,'')),''),
    shipping_neighborhood=nullif(btrim(coalesce(p_neighborhood,'')),''), shipping_city=btrim(p_city),
    shipping_state=btrim(p_state), buyer_postal_code=v_postal,
    shipping_branch_name=case when p_destination_type='carrier_branch' then btrim(p_branch_name) else null end,
    shipping_destination_set_at=now(), last_message_at=now()
  where id=c.id;
end $$;
revoke all on function public.set_conversation_shipping_destination(uuid,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.set_conversation_shipping_destination(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;

-- 2. Confirmaciones del protocolo de entrega y bitácora de correo.
alter table public.orders add column if not exists buyer_id_delivery_acknowledged_at timestamptz;
alter table public.orders add column if not exists seller_id_delivery_acknowledged_at timestamptz;
alter table public.orders add column if not exists seller_evidence_completed_at timestamptz;
alter table public.orders add column if not exists buyer_receipt_evidence_completed_at timestamptz;
alter table public.orders add column if not exists checkout_legal_bundle_hash text;
alter table public.shipments add column if not exists id_delivery_required boolean not null default false;
alter table public.shipments add column if not exists proof_of_delivery_reference text;
alter table public.shipments add column if not exists delivery_recipient_name text;

create or replace function public.acknowledge_id_delivery(p_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.status not in('awaiting_payment','payment_processing') then raise exception 'La aceptación ya no puede modificarse'; end if;
  update public.orders set buyer_id_delivery_acknowledged_at=coalesce(buyer_id_delivery_acknowledged_at,now()),updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'id_delivery_acknowledged',jsonb_build_object('required',true));
end $$;
revoke all on function public.acknowledge_id_delivery(uuid) from public;
grant execute on function public.acknowledge_id_delivery(uuid) to authenticated;

create or replace function public.accept_order_checkout_terms_v2(p_order_id uuid,p_terms_version text,p_legal_bundle_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.status not in('awaiting_payment','payment_processing') then raise exception 'El pedido ya no admite aceptación'; end if;
  if nullif(btrim(coalesce(p_terms_version,'')),'') is null or p_legal_bundle_hash!~'^[a-f0-9]{64}$' then raise exception 'Versión legal inválida'; end if;
  update public.orders set checkout_terms_version=btrim(p_terms_version),checkout_legal_bundle_hash=p_legal_bundle_hash,checkout_terms_accepted_at=now(),checkout_charge_acknowledged_at=now(),updated_at=now() where id=o.id;
  insert into public.legal_acceptances(user_id,document_type,document_version,source) values((select auth.uid()),'buyer_checkout',btrim(p_terms_version),'order_checkout:'||o.id::text||':'||p_legal_bundle_hash) on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'checkout_terms_accepted',jsonb_build_object('version',btrim(p_terms_version),'sha256',p_legal_bundle_hash));
end $$;
revoke all on function public.accept_order_checkout_terms_v2(uuid,text,text) from public;
grant execute on function public.accept_order_checkout_terms_v2(uuid,text,text) to authenticated;

alter table public.notifications add column if not exists email_attempts integer not null default 0;
alter table public.notifications add column if not exists email_provider_id text;
alter table public.notifications add column if not exists email_last_attempt_at timestamptz;
alter table public.notifications add column if not exists email_next_attempt_at timestamptz;
alter table public.notifications add column if not exists email_last_error text;
create index if not exists notifications_email_outbox_idx
  on public.notifications(email_status,email_next_attempt_at,created_at)
  where email_status in('pending','failed');

create table if not exists public.admin_action_logs(
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  action text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_action_logs enable row level security;
drop policy if exists "admins read action log" on public.admin_action_logs;
create policy "admins read action log" on public.admin_action_logs for select to authenticated using(public.is_admin());
revoke all on public.admin_action_logs from anon,authenticated;
grant select on public.admin_action_logs to authenticated;

-- 3. Aceptación de oferta: tarifa activa, no porcentaje escrito en código, y
-- snapshot inmutable del destino compartido antes del pago.
create or replace function public.accept_offer(p_offer_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare o public.offers; c public.conversations; f public.marketplace_fee_configs; v_order uuid; v_total integer; v_commission integer;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null or o.status<>'pending' then raise exception 'La oferta ya no está disponible'; end if;
  if o.expires_at<=now() then update public.offers set status='expired',responded_at=now(),updated_at=now() where id=o.id; raise exception 'La oferta venció'; end if;
  if o.buyer_id<>(select auth.uid()) or not public.is_active_user() then raise exception 'No autorizado'; end if;
  select * into c from public.conversations where id=o.conversation_id for update;
  if c.shipping_destination_set_at is null then raise exception 'Comparte primero el destino y el nombre completo de quien recibirá'; end if;
  perform 1 from public.dresses where id=o.dress_id and status='approved' for update;
  if not found then raise exception 'El vestido ya no está disponible'; end if;
  select id into v_order from public.orders where offer_id=o.id and status not in('cancelled','refunded','completed') order by created_at desc limit 1;
  if v_order is not null then return v_order; end if;
  if exists(select 1 from public.orders where dress_id=o.dress_id and buyer_id=o.buyer_id and status not in('cancelled','refunded','completed')) then raise exception 'Ya existe un pedido activo'; end if;
  select * into f from public.marketplace_fee_configs where is_active=true and effective_from<=now() and(effective_until is null or effective_until>now()) order by effective_from desc limit 1;
  if f.id is null then raise exception 'No existe configuración de tarifas activa'; end if;
  v_total:=o.amount_mxn+o.shipping_mxn; v_commission:=round(v_total*f.seller_commission_bps/10000.0);
  update public.offers set status='accepted',accepted_at=now(),responded_at=now(),updated_at=now() where id=o.id;
  insert into public.offer_events(offer_id,actor_id,event_type) values(o.id,(select auth.uid()),'accepted');
  insert into public.orders(dress_id,offer_id,buyer_id,seller_id,status,subtotal_mxn,shipping_mxn,commission_mxn,total_mxn,seller_net_mxn,seller_transfer_mxn,shipping_quote_set_at,payment_deadline_at,fee_config_id,seller_commission_bps)
  values(o.dress_id,o.id,o.buyer_id,o.seller_id,'awaiting_payment',o.amount_mxn,o.shipping_mxn,v_commission,v_total,v_total-v_commission,v_total-v_commission,now(),now()+interval '48 hours',f.id,f.seller_commission_bps)
  returning id into v_order;
  insert into public.order_shipping_addresses(order_id,recipient_name,phone,street1,street2,neighborhood,city,state,postal_code,delivery_notes)
  values(v_order,c.recipient_full_name,c.recipient_phone,c.shipping_street1,c.shipping_street2,c.shipping_neighborhood,c.shipping_city,c.shipping_state,c.buyer_postal_code,
    case when c.shipping_destination_type='carrier_branch' then 'Entrega ocurre: '||coalesce(c.shipping_branch_name,'Sucursal de paquetería') else null end);
  insert into public.notifications(user_id,order_id,dress_id,kind,title,body) values(o.seller_id,v_order,o.dress_id,'offer_accepted','Oferta aceptada','La compradora aceptó tu oferta. Tiene 48 horas para completar el pago.');
  return v_order;
end $$;
revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- La vendedora puede ver el snapshot solamente cuando el pago fue confirmado y no está bloqueado.
drop policy if exists "seller reads paid order address" on public.order_shipping_addresses;
create policy "seller reads paid order address" on public.order_shipping_addresses for select to authenticated
using(exists(select 1 from public.orders o where o.id=order_id and o.seller_id=(select auth.uid()) and o.status in('paid','preparing_shipment','shipped','delivered','inspection','completed') and o.shipping_blocked_at is null));

-- 4. Protocolo obligatorio de envío: seguro, firma, identificación y evidencia mínima.
create or replace function public.mark_order_shipped(p_order_id uuid,p_carrier text,p_tracking_number text,p_insured boolean default false,p_signature boolean default false,p_id_delivery boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; v_pre integer; v_packed integer; v_receipt integer;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.status not in('paid','preparing_shipment') or o.shipping_blocked_at is not null then raise exception 'El pedido no puede enviarse'; end if;
  if o.seller_ship_by is not null and now()>o.seller_ship_by then raise exception 'El plazo de cinco días naturales venció'; end if;
  if nullif(btrim(coalesce(p_carrier,'')),'') is null or nullif(btrim(coalesce(p_tracking_number,'')),'') is null then raise exception 'Paquetería y guía son obligatorias'; end if;
  if not p_insured or not p_signature or not p_id_delivery then raise exception 'El envío debe incluir seguro, firma y entrega contra identificación'; end if;
  select count(*) into v_pre from public.order_evidence where order_id=o.id and uploaded_by=(select auth.uid()) and evidence_type='seller_pre_ship';
  select count(*) into v_packed from public.order_evidence where order_id=o.id and uploaded_by=(select auth.uid()) and evidence_type='seller_packed';
  select count(*) into v_receipt from public.order_evidence where order_id=o.id and uploaded_by=(select auth.uid()) and evidence_type='seller_shipping_receipt';
  if v_pre=0 or v_packed=0 or v_receipt=0 then raise exception 'Sube evidencia del vestido, paquete cerrado y comprobante de paquetería'; end if;
  insert into public.shipments(order_id,direction,carrier,tracking_number,status,insured,signature_required,id_delivery_required,shipped_at)
  values(o.id,'outbound',btrim(p_carrier),btrim(p_tracking_number),'in_transit',true,true,true,now())
  on conflict(order_id) where direction='outbound' do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='in_transit',insured=true,signature_required=true,id_delivery_required=true,shipped_at=coalesce(public.shipments.shipped_at,now()),updated_at=now();
  update public.orders set status='shipped',carrier=btrim(p_carrier),tracking_number=btrim(p_tracking_number),shipped_at=coalesce(shipped_at,now()),shipping_insurance_confirmed=true,shipping_signature_confirmed=true,seller_id_delivery_acknowledged_at=now(),seller_evidence_completed_at=now(),updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'shipped',jsonb_build_object('carrier',btrim(p_carrier),'tracking_number',btrim(p_tracking_number),'insured',true,'signature',true,'id_delivery',true));
  insert into public.notifications(user_id,order_id,dress_id,kind,title,body) values(o.buyer_id,o.id,o.dress_id,'shipment_registered','Tu vestido fue enviado','La vendedora registró la guía. La entrega requiere firma e identificación oficial.');
end $$;
revoke all on function public.mark_order_shipped(uuid,text,text,boolean,boolean,boolean) from public;
grant execute on function public.mark_order_shipped(uuid,text,text,boolean,boolean,boolean) to authenticated;

-- 5. La administradora puede adelantar el barrido automático, nunca saltarse
-- la entrega, las 48 horas, una reclamación o un bloqueo de riesgo.
create or replace function public.admin_release_seller_balance(p_order_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Escribe el motivo de la liberación'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.delivered_at is null or coalesce(o.dispute_deadline_at,o.inspection_deadline_at,o.claim_deadline_at)>now() then raise exception 'La ventana de protección todavía no termina'; end if;
  if o.shipping_blocked_at is not null or coalesce(o.stripe_dispute_status,'') not in('','won') then raise exception 'El saldo está bloqueado por riesgo'; end if;
  if exists(select 1 from public.claims where order_id=o.id and status not in('rejected','closed','refunded')) then raise exception 'Existe una reclamación activa'; end if;
  update public.orders set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=o.id;
  update public.seller_payouts set status='releasable',releasable_at=coalesce(releasable_at,now()),updated_at=now() where order_id=o.id and status='held';
  insert into public.admin_action_logs(admin_id,order_id,action,reason) values((select auth.uid()),o.id,'release_seller_balance',btrim(p_reason));
end $$;
revoke all on function public.admin_release_seller_balance(uuid,text) from public;
grant execute on function public.admin_release_seller_balance(uuid,text) to authenticated;

-- Comentarios reales; no se generan estrellas automáticas.
alter table public.ratings add column if not exists comment text;
alter table public.ratings drop constraint if exists ratings_comment_length_check;
alter table public.ratings add constraint ratings_comment_length_check check(comment is null or char_length(comment)<=1000);

-- La vista anterior termina en display_name; se recrea para añadir columnas
-- sin intentar renombrar posiciones existentes mediante CREATE OR REPLACE.
drop view if exists public.public_profiles;
create view public.public_profiles with (security_barrier=true) as
select p.id,p.identity_verified,p.response_time_minutes,p.rating_average,p.rating_count,
  (select count(*)::integer from public.orders o where o.seller_id=p.id and o.status='completed') as completed_sales_count,
  case when nullif(btrim(p.full_name),'') is null or p.full_name like '%@%' or p.full_name~*'^https?://' then null else btrim(p.full_name) end as display_name
from public.profiles p where p.is_blocked=false;
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon,authenticated;

create or replace view public.public_seller_reviews with (security_barrier=true) as
select r.id,r.reviewee_id,r.rating,r.comment,r.created_at
from public.ratings r join public.orders o on o.id=r.order_id
where o.status='completed' and r.reviewer_id=o.buyer_id and r.reviewee_id=o.seller_id;
revoke all on public.public_seller_reviews from public;
grant select on public.public_seller_reviews to anon,authenticated;

notify pgrst,'reload schema';

commit;
