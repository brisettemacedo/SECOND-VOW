-- ============================================================
-- SECOND VOW — 0012 · Pagos + tracking automático + ventana de 72 h
-- REQUIERE 0001–0011 ya aplicadas. NO modifica el historial anterior.
-- Modelo:
-- · La vendedora compra la guía con la paquetería que elija.
-- · SECOND VOW registra el tracking en Ship24.
-- · La entrega se acredita por el PRIMER disparador válido:
--      buyer_confirmed_at O carrier_delivered_at.
-- · Desde delivered_at corren exactamente 72 horas para reclamación.
-- · Sin reclamación activa, el saldo se vuelve liberable.
-- · Stripe usa separate charges and transfers; el dinero no se transfiere
--   a la cuenta conectada hasta que la operación sea liberable.
-- ============================================================

begin;

-- 1) Modelo financiero correcto para marketplace con retención en plataforma.
alter table public.marketplace_fee_configs drop constraint if exists fee_charge_model_check;
alter table public.marketplace_fee_configs
  add constraint fee_charge_model_check check(charge_model in('direct_charge_manual_payout','separate_charges_transfers'));
update public.marketplace_fee_configs
set charge_model='separate_charges_transfers', processor_fee_borne_by='platform'
where is_active=true;

-- 2) Tracking normalizado y evidencia de entrega.
alter table public.shipments add column if not exists tracking_provider text;
alter table public.shipments add column if not exists tracking_provider_id text;
alter table public.shipments add column if not exists tracking_provider_status text;
alter table public.shipments add column if not exists tracking_provider_event_id text;
alter table public.shipments add column if not exists last_tracking_event_at timestamptz;
alter table public.shipments add column if not exists carrier_delivered_at timestamptz;
alter table public.shipments add column if not exists tracking_registered_at timestamptz;
alter table public.shipments add column if not exists tracking_error text;

create unique index if not exists shipments_tracking_provider_id_unique
  on public.shipments(tracking_provider,tracking_provider_id)
  where tracking_provider_id is not null;

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  status_milestone text,
  status_code text,
  raw_status text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique(provider,provider_event_id)
);
create index if not exists idx_tracking_events_shipment_occurred
  on public.tracking_events(shipment_id,occurred_at desc);

alter table public.orders add column if not exists buyer_confirmed_at timestamptz;
alter table public.orders add column if not exists carrier_delivered_at timestamptz;
alter table public.orders add column if not exists delivery_source text;
alter table public.orders add column if not exists dispute_deadline_at timestamptz;

alter table public.orders drop constraint if exists orders_delivery_source_check;
alter table public.orders add constraint orders_delivery_source_check
  check(delivery_source is null or delivery_source in('buyer','carrier'));

-- 3) Stripe: separar transferencia a Connect de payout bancario.
alter table public.orders add column if not exists stripe_transfer_group text;
alter table public.seller_payouts add column if not exists transfer_id text;
alter table public.seller_payouts add column if not exists transferred_at timestamptz;
create unique index if not exists seller_payouts_transfer_unique
  on public.seller_payouts(transfer_id) where transfer_id is not null;

-- 4) El primer disparador válido fija delivered_at. Nunca se mueve hacia adelante.
create or replace function public.apply_order_delivery(
  p_order_id uuid,
  p_source text,
  p_delivered_at timestamptz
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.orders; v_at timestamptz;
begin
  if auth.role()<>'service_role' and not public.is_admin() then raise exception 'Solo backend/admin'; end if;
  if p_source not in('buyer','carrier') then raise exception 'Fuente de entrega inválida'; end if;
  v_at:=coalesce(p_delivered_at,now());
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.status not in('shipped','delivered','inspection','completed','claim_open') then raise exception 'Estado incompatible con entrega'; end if;

  update public.orders set
    buyer_confirmed_at=case when p_source='buyer' then coalesce(buyer_confirmed_at,v_at) else buyer_confirmed_at end,
    carrier_delivered_at=case when p_source='carrier' then coalesce(carrier_delivered_at,v_at) else carrier_delivered_at end,
    delivered_at=case when delivered_at is null or v_at<delivered_at then v_at else delivered_at end,
    delivery_source=case when delivered_at is null or v_at<delivered_at then p_source else delivery_source end,
    inspection_deadline_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else inspection_deadline_at end,
    dispute_deadline_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else dispute_deadline_at end,
    claim_deadline_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else claim_deadline_at end,
    payout_release_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else payout_release_at end,
    status=case when status in('shipped','delivered') then 'inspection' else status end,
    updated_at=now()
  where id=p_order_id;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(p_order_id,case when p_source='buyer' then auth.uid() else null end,'delivery_confirmed',
         jsonb_build_object('source',p_source,'delivered_at',v_at));
end;
$$;
revoke all on function public.apply_order_delivery(uuid,text,timestamptz) from public;

-- 5) Compradora confirma recepción: mismo motor, sin depender del carrier.
create or replace function public.confirm_order_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.orders; v_at timestamptz:=now();
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.status not in('shipped','delivered','inspection') then raise exception 'Estado incompatible'; end if;

  update public.orders set
    buyer_confirmed_at=coalesce(buyer_confirmed_at,v_at),
    delivered_at=case when delivered_at is null or v_at<delivered_at then v_at else delivered_at end,
    delivery_source=case when delivered_at is null or v_at<delivered_at then 'buyer' else delivery_source end,
    inspection_deadline_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else inspection_deadline_at end,
    dispute_deadline_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else dispute_deadline_at end,
    claim_deadline_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else claim_deadline_at end,
    payout_release_at=case when delivered_at is null or v_at<delivered_at then v_at+interval '72 hours' else payout_release_at end,
    status='inspection',updated_at=now()
  where id=p_order_id;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(p_order_id,auth.uid(),'delivery_confirmed',jsonb_build_object('source','buyer','delivered_at',v_at));
end;
$$;
revoke all on function public.confirm_order_delivered(uuid) from public;
grant execute on function public.confirm_order_delivered(uuid) to authenticated;

-- 6) Backend registra/actualiza el tracker creado en Ship24.
create or replace function public.backend_register_tracking_provider(
  p_order_id uuid,
  p_provider text,
  p_provider_tracker_id text,
  p_error text default null
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  update public.shipments set
    tracking_provider=p_provider,
    tracking_provider_id=p_provider_tracker_id,
    tracking_registered_at=case when p_provider_tracker_id is not null then now() else tracking_registered_at end,
    tracking_error=p_error,
    updated_at=now()
  where order_id=p_order_id and direction='outbound';
end;
$$;
revoke all on function public.backend_register_tracking_provider(uuid,text,text,text) from public;

-- 7) Webhook Ship24: idempotente, usa occurrenceDatetime y solo "delivered" inicia plazo.
create or replace function public.backend_process_tracking_event(
  p_provider text,
  p_tracker_id text,
  p_provider_event_id text,
  p_status_milestone text,
  p_status_code text,
  p_raw_status text,
  p_occurred_at timestamptz,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path=''
as $$
declare s public.shipments; v_order public.orders; v_rows integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into s from public.shipments
   where tracking_provider=p_provider and tracking_provider_id=p_tracker_id for update;
  if s.id is null then raise exception 'Tracker desconocido'; end if;

  insert into public.tracking_events(shipment_id,provider,provider_event_id,status_milestone,status_code,raw_status,occurred_at,payload)
  values(s.id,p_provider,p_provider_event_id,p_status_milestone,p_status_code,p_raw_status,p_occurred_at,coalesce(p_payload,'{}'::jsonb))
  on conflict(provider,provider_event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows=0 then return; end if;

  -- No retroceder estado por webhooks fuera de orden.
  if s.last_tracking_event_at is null or p_occurred_at>=s.last_tracking_event_at then
    update public.shipments set
      tracking_provider_status=p_status_milestone,
      tracking_provider_event_id=p_provider_event_id,
      last_tracking_event_at=p_occurred_at,
      status=case
        when p_status_milestone='delivered' then 'delivered'
        when p_status_milestone='exception' then 'exception'
        when p_status_milestone in('in_transit','out_for_delivery','failed_attempt','available_for_pickup') then 'in_transit'
        else status end,
      carrier_delivered_at=case when p_status_milestone='delivered' then coalesce(carrier_delivered_at,p_occurred_at) else carrier_delivered_at end,
      updated_at=now()
    where id=s.id;
  end if;

  if p_status_milestone='delivered' then
    select * into v_order from public.orders where id=s.order_id for update;
    update public.orders set
      carrier_delivered_at=coalesce(carrier_delivered_at,p_occurred_at),
      delivered_at=case when delivered_at is null or p_occurred_at<delivered_at then p_occurred_at else delivered_at end,
      delivery_source=case when delivered_at is null or p_occurred_at<delivered_at then 'carrier' else delivery_source end,
      inspection_deadline_at=case when delivered_at is null or p_occurred_at<delivered_at then p_occurred_at+interval '72 hours' else inspection_deadline_at end,
      dispute_deadline_at=case when delivered_at is null or p_occurred_at<delivered_at then p_occurred_at+interval '72 hours' else dispute_deadline_at end,
      claim_deadline_at=case when delivered_at is null or p_occurred_at<delivered_at then p_occurred_at+interval '72 hours' else claim_deadline_at end,
      payout_release_at=case when delivered_at is null or p_occurred_at<delivered_at then p_occurred_at+interval '72 hours' else payout_release_at end,
      status=case when status in('shipped','delivered') then 'inspection' else status end,
      updated_at=now()
    where id=s.order_id;
    insert into public.order_events(order_id,event_type,metadata)
    values(s.order_id,'carrier_delivered',jsonb_build_object('provider',p_provider,'tracker_id',p_tracker_id,'event_id',p_provider_event_id,'delivered_at',p_occurred_at));
  end if;
end;
$$;
revoke all on function public.backend_process_tracking_event(text,text,text,text,text,text,timestamptz,jsonb) from public;

-- 8) Vencimiento de 72h: completar pedido + volver payout liberable en una sola operación.
create or replace function public.backend_finalize_expired_inspections()
returns integer
language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  with finished as (
    update public.orders o
       set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
     where o.status='inspection'
       and coalesce(o.dispute_deadline_at,o.inspection_deadline_at,o.claim_deadline_at)<=now()
       and not exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded'))
     returning o.id,o.dress_id
  ), released as (
    update public.seller_payouts p set status='releasable',releasable_at=coalesce(releasable_at,now()),updated_at=now()
    where p.status='held' and exists(select 1 from finished f where f.id=p.order_id)
    returning p.id
  )
  select count(*) into v_count from finished;

  update public.dresses d set status='sold'
  where exists(select 1 from public.orders o where o.dress_id=d.id and o.status='completed');
  return v_count;
end;
$$;
revoke all on function public.backend_finalize_expired_inspections() from public;

-- 9) La confirmación de estado NO acorta la protección de 72 horas.
-- Se conserva la RPC por compatibilidad con la UI previa, pero solo registra conformidad.
create or replace function public.accept_order_condition(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.status not in('inspection','delivered') then raise exception 'El pedido todavía no puede aceptarse'; end if;
  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'Existe una reclamación abierta'; end if;
  update public.orders set accepted_by_buyer_at=coalesce(accepted_by_buyer_at,now()),updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type) values(o.id,auth.uid(),'buyer_condition_confirmed');
end;
$$;
revoke all on function public.accept_order_condition(uuid) from public;
grant execute on function public.accept_order_condition(uuid) to authenticated;

-- 10) Reclamación usa dispute_deadline_at como fuente canónica.
create or replace function public.open_order_claim(p_order_id uuid,p_reason_code text,p_description text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare o public.orders; v_claim uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if o.delivered_at is null then raise exception 'El pedido todavía no figura como entregado'; end if;
  if now()>coalesce(o.dispute_deadline_at,o.claim_deadline_at,o.delivered_at+interval '72 hours') then raise exception 'El plazo de 72 horas ha vencido'; end if;
  if p_reason_code not in('not_received','wrong_item','counterfeit','damaged_undisclosed','materially_not_as_described','undisclosed_alteration','measurements_materially_incorrect','missing_included_component') then raise exception 'Motivo no cubierto'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'Describe el incumplimiento'; end if;
  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'Ya existe una reclamación activa'; end if;
  insert into public.claims(order_id,opened_by,reason,reason_code,description,status)
  values(o.id,auth.uid(),p_reason_code,p_reason_code,btrim(p_description),'open') returning id into v_claim;
  update public.orders set status='claim_open',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,auth.uid(),'claim_opened',jsonb_build_object('claim_id',v_claim,'reason',p_reason_code));
  return v_claim;
end;
$$;
revoke all on function public.open_order_claim(uuid,text,text) from public;
grant execute on function public.open_order_claim(uuid,text,text) to authenticated;

-- 11) Backend registra transferencia Stripe y payout bancario.
create or replace function public.backend_mark_transfer_created(p_payout_row_id uuid,p_transfer_id text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  update public.seller_payouts set transfer_id=p_transfer_id,transferred_at=now(),status='processing',processing_at=coalesce(processing_at,now()),updated_at=now()
  where id=p_payout_row_id and status in('requested','processing');
end;
$$;
revoke all on function public.backend_mark_transfer_created(uuid,text) from public;

-- 12) RLS: tracking crudo no es público; partes pueden consultar eventos del pedido.
alter table public.tracking_events enable row level security;
drop policy if exists "parties read tracking events" on public.tracking_events;
create policy "parties read tracking events" on public.tracking_events for select to authenticated
using(exists(
  select 1 from public.shipments s join public.orders o on o.id=s.order_id
  where s.id=shipment_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())
));
revoke all on public.tracking_events from anon,authenticated;
grant select on public.tracking_events to authenticated;

commit;
