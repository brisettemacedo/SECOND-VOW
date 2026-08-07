-- ============================================================
-- SECOND VOW — 0009 · Pedidos, envíos, reclamaciones y devoluciones
-- Ejecutar DESPUÉS de 0008.
-- Política: devolución SOLO por incumplimiento sustancial.
-- Reclamación: SOLO durante las 72 horas posteriores a la entrega registrada.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Pedidos: plazos y estados más precisos
-- ------------------------------------------------------------
alter table public.orders add column if not exists payment_deadline_at timestamptz;
alter table public.orders add column if not exists seller_ship_by timestamptz;
alter table public.orders add column if not exists inspection_deadline_at timestamptz;
alter table public.orders add column if not exists payout_release_at timestamptz;
alter table public.orders add column if not exists accepted_by_buyer_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;

alter table public.orders add column if not exists shipping_quote_set_at timestamptz;
alter table public.orders add column if not exists shipping_carrier_declared text;
alter table public.orders add column if not exists shipping_model text not null default 'seller_arranged';

alter table public.orders drop constraint if exists orders_shipping_model_check;
alter table public.orders add constraint orders_shipping_model_check
  check(shipping_model in('seller_arranged'));

update public.orders
set payment_deadline_at = coalesce(payment_deadline_at, created_at + interval '24 hours')
where status = 'awaiting_payment';

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check check (status in (
    'awaiting_payment',
    'payment_processing',
    'paid',
    'preparing_shipment',
    'shipped',
    'delivered',
    'inspection',
    'completed',
    'claim_open',
    'return_authorized',
    'return_shipped',
    'returned',
    'refund_pending',
    'refunded',
    'cancelled'
  ));

create index if not exists idx_orders_buyer_created on public.orders(buyer_id, created_at desc);
create index if not exists idx_orders_seller_created on public.orders(seller_id, created_at desc);
create index if not exists idx_orders_status_deadlines on public.orders(status, payment_deadline_at, seller_ship_by);

-- ------------------------------------------------------------
-- 2) Dirección privada del pedido
-- Nunca se publica en perfiles ni catálogo.
-- El backend de paquetería podrá usarla para generar guía.
-- ------------------------------------------------------------
create table if not exists public.order_shipping_addresses (
  order_id uuid primary key references public.orders(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  street1 text not null,
  street2 text,
  neighborhood text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'MX',
  delivery_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_address_country_check check(country_code='MX')
);

-- ------------------------------------------------------------
-- 3) Envíos. Soporta salida y devolución.
-- label_url se guarda como referencia privada; idealmente URL firmada corta.
-- ------------------------------------------------------------
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  direction text not null default 'outbound',
  provider text,
  carrier text,
  service_level text,
  tracking_number text,
  external_shipment_id text,
  label_storage_path text,
  status text not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_direction_check check(direction in('outbound','return')),
  constraint shipments_status_check check(status in(
    'pending','label_created','in_transit','delivered','exception','cancelled'
  ))
);

create unique index if not exists one_outbound_shipment_per_order
  on public.shipments(order_id) where direction='outbound';

create unique index if not exists one_return_shipment_per_order
  on public.shipments(order_id) where direction='return';

create unique index if not exists shipments_tracking_unique
  on public.shipments(carrier, tracking_number)
  where tracking_number is not null;

-- ------------------------------------------------------------
-- 4) Bitácora inmutable de pedido
-- ------------------------------------------------------------
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_events_order on public.order_events(order_id, created_at);

-- ------------------------------------------------------------
-- 5) Reclamaciones: razón estructurada y condiciones de devolución
-- ------------------------------------------------------------
alter table public.claims add column if not exists reason_code text;
alter table public.claims add column if not exists seller_response text;
alter table public.claims add column if not exists admin_notes text;
alter table public.claims add column if not exists decision text;
alter table public.claims add column if not exists return_authorized_at timestamptz;
alter table public.claims add column if not exists return_shipped_at timestamptz;
alter table public.claims add column if not exists return_delivered_at timestamptz;
alter table public.claims add column if not exists seller_return_objection_deadline_at timestamptz;
alter table public.claims add column if not exists refund_amount_mxn integer;

-- Las filas antiguas usan reason libre; las nuevas usarán reason_code vía RPC.
alter table public.claims
  drop constraint if exists claims_reason_code_check;

alter table public.claims
  add constraint claims_reason_code_check check (
    reason_code is null or reason_code in (
      'not_received',
      'wrong_item',
      'counterfeit',
      'damaged_undisclosed',
      'materially_not_as_described',
      'undisclosed_alteration',
      'measurements_materially_incorrect',
      'missing_included_component'
    )
  );

alter table public.claims
  drop constraint if exists claims_status_check;

alter table public.claims
  add constraint claims_status_check check(status in(
    'open','under_review','seller_response','approved_return','rejected',
    'return_shipped','returned','refund_pending','refunded','closed'
  ));

-- ------------------------------------------------------------
-- 6) Evidencia privada de reclamaciones
-- ------------------------------------------------------------
create table if not exists public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  evidence_type text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint claim_evidence_type_check check(evidence_type in(
    'package','shipping_label','opening','full_dress','defect','measurement',
    'authenticity','packing_before_shipping','other'
  ))
);

create index if not exists idx_claim_evidence_claim on public.claim_evidence(claim_id, created_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'claim-evidence','claim-evidence',false,20971520,
  array['image/jpeg','image/png','image/webp','video/mp4','application/pdf']::text[]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 7) Guardar dirección de la compradora
-- ------------------------------------------------------------
create or replace function public.set_order_shipping_address(
  p_order_id uuid,
  p_recipient_name text,
  p_phone text,
  p_street1 text,
  p_street2 text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_delivery_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id=p_order_id;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado';end if;
  if o.status not in('awaiting_payment','payment_processing','paid') then raise exception 'La dirección ya no puede modificarse';end if;

  if nullif(btrim(p_recipient_name),'') is null
     or nullif(btrim(p_phone),'') is null
     or nullif(btrim(p_street1),'') is null
     or nullif(btrim(p_city),'') is null
     or nullif(btrim(p_state),'') is null
     or nullif(btrim(p_postal_code),'') is null then
    raise exception 'Dirección incompleta';
  end if;

  insert into public.order_shipping_addresses(
    order_id,recipient_name,phone,street1,street2,neighborhood,city,state,postal_code,delivery_notes
  ) values(
    p_order_id,btrim(p_recipient_name),btrim(p_phone),btrim(p_street1),nullif(btrim(p_street2),''),
    nullif(btrim(p_neighborhood),''),btrim(p_city),btrim(p_state),btrim(p_postal_code),p_delivery_notes
  )
  on conflict(order_id) do update set
    recipient_name=excluded.recipient_name,
    phone=excluded.phone,
    street1=excluded.street1,
    street2=excluded.street2,
    neighborhood=excluded.neighborhood,
    city=excluded.city,
    state=excluded.state,
    postal_code=excluded.postal_code,
    delivery_notes=excluded.delivery_notes,
    updated_at=now();
end;
$$;

revoke all on function public.set_order_shipping_address(uuid,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.set_order_shipping_address(uuid,text,text,text,text,text,text,text,text,text) to authenticated;

-- ------------------------------------------------------------
-- 8) Registrar envío de salida manualmente
-- Más adelante un proveedor de paquetería lo hará mediante webhook.
-- ------------------------------------------------------------
create or replace function public.mark_order_shipped(
  p_order_id uuid,
  p_carrier text,
  p_tracking_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_shipment uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>auth.uid() then raise exception 'No autorizado';end if;
  if o.status not in('paid','preparing_shipment') then raise exception 'El pedido no puede marcarse como enviado';end if;
  if nullif(btrim(p_carrier),'') is null or nullif(btrim(p_tracking_number),'') is null then raise exception 'Falta paquetería o rastreo';end if;

  insert into public.shipments(order_id,direction,carrier,tracking_number,status,shipped_at)
  values(p_order_id,'outbound',btrim(p_carrier),btrim(p_tracking_number),'in_transit',now())
  on conflict(order_id) where direction='outbound'
  do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,now()),updated_at=now()
  returning id into v_shipment;

  update public.orders
  set status='shipped',carrier=btrim(p_carrier),tracking_number=btrim(p_tracking_number),shipped_at=now(),updated_at=now()
  where id=p_order_id;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(p_order_id,auth.uid(),'shipped',jsonb_build_object('shipment_id',v_shipment,'carrier',p_carrier,'tracking',p_tracking_number));
end;
$$;

revoke all on function public.mark_order_shipped(uuid,text,text) from public;
grant execute on function public.mark_order_shipped(uuid,text,text) to authenticated;

-- ------------------------------------------------------------
-- 9) Confirmar entrega
-- Puede llamarlo la compradora o service_role desde webhook de paquetería.
-- Abre 72 horas de inspección para liberación ordinaria del pago,
-- y ese MISMO plazo de 72 horas es el único plazo para abrir reclamación.
-- ------------------------------------------------------------
create or replace function public.confirm_order_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_privileged boolean := auth.role()='service_role' or public.is_admin();
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente';end if;
  if not v_privileged and o.buyer_id<>auth.uid() then raise exception 'No autorizado';end if;
  if o.status not in('shipped','delivered','inspection') then raise exception 'Estado incompatible';end if;

  update public.orders
  set status='inspection',
      delivered_at=coalesce(delivered_at,now()),
      inspection_deadline_at=coalesce(inspection_deadline_at,now()+interval '72 hours'),
      payout_release_at=coalesce(payout_release_at,now()+interval '72 hours'),
      claim_deadline_at=coalesce(claim_deadline_at,now()+interval '72 hours'),
      updated_at=now()
  where id=p_order_id;

  update public.shipments
  set status='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now()
  where order_id=p_order_id and direction='outbound';

  insert into public.order_events(order_id,actor_id,event_type)
  values(p_order_id,auth.uid(),'delivered');
end;
$$;

revoke all on function public.confirm_order_delivered(uuid) from public;
grant execute on function public.confirm_order_delivered(uuid) to authenticated;

-- La compradora puede aceptar antes de 72h.
create or replace function public.accept_order_condition(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado';end if;
  if o.status not in('inspection','delivered') then raise exception 'El pedido todavía no puede aceptarse';end if;
  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed')) then raise exception 'Existe una reclamación abierta';end if;

  update public.orders
  set status='completed',accepted_by_buyer_at=now(),payout_release_at=now(),completed_at=now(),updated_at=now()
  where id=o.id;

  update public.dresses set status='sold' where id=o.dress_id;
  insert into public.order_events(order_id,actor_id,event_type) values(o.id,auth.uid(),'buyer_accepted');
end;
$$;

revoke all on function public.accept_order_condition(uuid) from public;
grant execute on function public.accept_order_condition(uuid) to authenticated;


-- Cierre automático al vencer las 72h sin reclamación.
-- Debe ejecutarse desde un cron/backend (por ejemplo, cada hora).
create or replace function public.backend_finalize_expired_inspections()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend';end if;

  with finished as (
    update public.orders o
    set status='completed', completed_at=coalesce(completed_at,now()), updated_at=now()
    where o.status='inspection'
      and o.inspection_deadline_at is not null
      and o.inspection_deadline_at<=now()
      and not exists(
        select 1 from public.claims c
        where c.order_id=o.id and c.status not in('rejected','closed','refunded')
      )
    returning o.id,o.dress_id
  )
  select count(*) into v_count from finished;

  update public.dresses d
  set status='sold'
  where exists(select 1 from public.orders o where o.dress_id=d.id and o.status='completed');

  return v_count;
end;
$$;
revoke all on function public.backend_finalize_expired_inspections() from public;

-- ------------------------------------------------------------
-- 10) Abrir reclamación
-- NO procede por talla/ajuste subjetivo o cambio de opinión.
-- ------------------------------------------------------------
create or replace function public.open_order_claim(
  p_order_id uuid,
  p_reason_code text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_claim uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>auth.uid() then raise exception 'No autorizado';end if;
  if o.delivered_at is null then raise exception 'El pedido todavía no figura como entregado';end if;
  if now()>coalesce(o.claim_deadline_at,o.delivered_at+interval '72 hours') then raise exception 'El plazo de 72 horas ha vencido';end if;

  if p_reason_code not in(
    'not_received','wrong_item','counterfeit','damaged_undisclosed',
    'materially_not_as_described','undisclosed_alteration',
    'measurements_materially_incorrect','missing_included_component'
  ) then raise exception 'Motivo no cubierto por la política de devolución';end if;

  if nullif(btrim(p_description),'') is null then raise exception 'Describe el incumplimiento';end if;

  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then
    raise exception 'Ya existe una reclamación activa';
  end if;

  insert into public.claims(order_id,opened_by,reason,reason_code,description,status)
  values(o.id,auth.uid(),p_reason_code,p_reason_code,btrim(p_description),'open')
  returning id into v_claim;

  update public.orders set status='claim_open',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,auth.uid(),'claim_opened',jsonb_build_object('claim_id',v_claim,'reason',p_reason_code));

  return v_claim;
end;
$$;

revoke all on function public.open_order_claim(uuid,text,text) from public;
grant execute on function public.open_order_claim(uuid,text,text) to authenticated;

-- ------------------------------------------------------------
-- 11) Autorizar devolución (admin)
-- 5 días naturales para entregar el vestido a la paquetería.
-- Al regresar, la vendedora tendrá 48h para objetar daños NUEVOS.
-- ------------------------------------------------------------
create or replace function public.admin_authorize_return(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.claims;
begin
  if not public.is_admin() then raise exception 'No autorizado';end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null or c.status not in('open','under_review','seller_response') then raise exception 'Reclamación no disponible';end if;

  update public.claims
  set status='approved_return',
      return_authorized_at=now(),
      return_shipping_deadline_at=now()+interval '5 days'
  where id=c.id;

  update public.orders set status='return_authorized',updated_at=now() where id=c.order_id;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(c.order_id,auth.uid(),'return_authorized',jsonb_build_object('claim_id',c.id));
end;
$$;

revoke all on function public.admin_authorize_return(uuid) from public;
grant execute on function public.admin_authorize_return(uuid) to authenticated;

-- ------------------------------------------------------------
-- 12) RLS
-- ------------------------------------------------------------
alter table public.order_shipping_addresses enable row level security;
alter table public.shipments enable row level security;
alter table public.order_events enable row level security;
alter table public.claim_evidence enable row level security;

-- Dirección: compradora ve/gestiona la suya. Admin/backend puede verla.
-- No se expone automáticamente a la vendedora; debe enviarse mediante guía.
drop policy if exists "buyer reads own order address" on public.order_shipping_addresses;
create policy "buyer reads own order address"
  on public.order_shipping_addresses for select to authenticated
  using(exists(select 1 from public.orders o where o.id=order_id and(o.buyer_id=auth.uid() or public.is_admin())));

-- Envíos visibles para ambas partes.
drop policy if exists "parties read shipments" on public.shipments;
create policy "parties read shipments"
  on public.shipments for select to authenticated
  using(exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())));

-- Eventos visibles para ambas partes, administración ve todo.
drop policy if exists "parties read order events" on public.order_events;
create policy "parties read order events"
  on public.order_events for select to authenticated
  using(exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())));

-- Evidencia visible para partes del pedido y admin.
drop policy if exists "parties read claim evidence" on public.claim_evidence;
create policy "parties read claim evidence"
  on public.claim_evidence for select to authenticated
  using(exists(
    select 1 from public.claims c join public.orders o on o.id=c.order_id
    where c.id=claim_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())
  ));

drop policy if exists "parties upload claim evidence" on public.claim_evidence;
create policy "parties upload claim evidence"
  on public.claim_evidence for insert to authenticated
  with check(uploaded_by=auth.uid() and exists(
    select 1 from public.claims c join public.orders o on o.id=c.order_id
    where c.id=claim_id and auth.uid() in(o.buyer_id,o.seller_id)
  ));

-- Storage claim evidence: {user_id}/{claim_id}/{file}
drop policy if exists "claim evidence upload participant" on storage.objects;
create policy "claim evidence upload participant"
  on storage.objects for insert to authenticated
  with check(
    bucket_id='claim-evidence'
    and(storage.foldername(name))[1]=auth.uid()::text
    and exists(
      select 1 from public.claims c join public.orders o on o.id=c.order_id
      where c.id=((storage.foldername(name))[2])::uuid
        and auth.uid() in(o.buyer_id,o.seller_id)
    )
  );

drop policy if exists "claim evidence read participant" on storage.objects;
create policy "claim evidence read participant"
  on storage.objects for select to authenticated
  using(
    bucket_id='claim-evidence'
    and exists(
      select 1 from public.claims c join public.orders o on o.id=c.order_id
      where c.id=((storage.foldername(name))[2])::uuid
        and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())
    )
  );


-- La policy original de 0005 permitía insertar claims directamente.
-- Se elimina: abrir reclamación pasa exclusivamente por open_order_claim(),
-- que aplica el límite estricto de 72 horas y motivos cubiertos.
drop policy if exists "buyer opens claim" on public.claims;
revoke insert on public.claims from authenticated;

-- ------------------------------------------------------------
-- 13) Quitamos actualización directa de orders.
-- A partir de aquí los cambios de estado sensibles son RPC/webhook.
-- ------------------------------------------------------------
drop policy if exists "parties update orders" on public.orders;
revoke update on public.orders from authenticated;

revoke all on public.order_shipping_addresses,public.shipments,public.order_events,public.claim_evidence from anon,authenticated;
grant select on public.order_shipping_addresses,public.shipments,public.order_events,public.claim_evidence to authenticated;
grant insert on public.claim_evidence to authenticated;

commit;
