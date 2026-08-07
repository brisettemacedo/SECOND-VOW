-- ============================================================
-- SECOND VOW — 0008 · Ofertas y contraofertas
-- Ejecutar DESPUÉS de 0007.
-- Incremental: mejora la tabla offers creada en 0005.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Campos para negociación trazable
-- ------------------------------------------------------------
alter table public.offers
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

alter table public.offers
  add column if not exists parent_offer_id uuid references public.offers(id) on delete set null;

alter table public.offers
  add column if not exists created_by uuid references public.profiles(id);

alter table public.offers
  add column if not exists currency text not null default 'MXN';

alter table public.offers
  add column if not exists note text;

alter table public.offers
  add column if not exists responded_at timestamptz;

alter table public.offers
  add column if not exists accepted_at timestamptz;

alter table public.offers
  add column if not exists cancelled_at timestamptz;

alter table public.offers
  drop constraint if exists offers_currency_check;

alter table public.offers
  add constraint offers_currency_check check (currency = 'MXN');

alter table public.offers
  drop constraint if exists offers_note_length_check;

alter table public.offers
  add constraint offers_note_length_check
  check (note is null or char_length(note) <= 500);

-- Nuevas ofertas: 48 horas. Es suficientemente breve para no congelar el vestido
-- y más razonable para una compra de alto valor que un plazo de pocas horas.
alter table public.offers
  alter column expires_at set default (now() + interval '48 hours');

update public.offers
set created_by = buyer_id
where created_by is null;

-- ------------------------------------------------------------
-- 2) Auditoría de eventos de oferta
-- ------------------------------------------------------------
create table if not exists public.offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offer_events_type_check check (
    event_type in ('created','countered','accepted','rejected','cancelled','expired')
  )
);

create index if not exists idx_offer_events_offer
  on public.offer_events (offer_id, created_at);

-- ------------------------------------------------------------
-- 3) Helper para expirar ofertas vencidas
-- Puede llamarse desde UI/cron sin perjudicar ofertas vigentes.
-- ------------------------------------------------------------
create or replace function public.expire_stale_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.offers
    set status = 'expired',
        responded_at = coalesce(responded_at, now()),
        updated_at = now()
    where status = 'pending'
      and expires_at <= now()
    returning id
  )
  select count(*) into v_count from expired;

  insert into public.offer_events(offer_id, event_type)
  select o.id, 'expired'
  from public.offers o
  where o.status = 'expired'
    and o.responded_at >= now() - interval '5 seconds'
    and not exists (
      select 1 from public.offer_events e
      where e.offer_id = o.id and e.event_type = 'expired'
    );

  return v_count;
end;
$$;

revoke all on function public.expire_stale_offers() from public;
grant execute on function public.expire_stale_offers() to authenticated;

-- ------------------------------------------------------------
-- 4) Crear oferta
-- Compradora solamente; el vestido debe estar aprobado.
-- ------------------------------------------------------------
create or replace function public.create_offer(
  p_dress_id uuid,
  p_amount_mxn integer,
  p_conversation_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_price integer;
  v_offer uuid;
begin
  if v_buyer is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_active_user() then
    raise exception 'La cuenta no puede crear ofertas';
  end if;

  if p_amount_mxn is null or p_amount_mxn <= 0 then
    raise exception 'Monto inválido';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'La nota es demasiado larga';
  end if;

  perform public.expire_stale_offers();

  select seller_id, precio_venta_mxn
  into v_seller, v_price
  from public.dresses
  where id = p_dress_id
    and status = 'approved'
  for update;

  if v_seller is null then
    raise exception 'Vestido no disponible';
  end if;

  if v_seller = v_buyer then
    raise exception 'No puedes ofertar por tu propio vestido';
  end if;

  if p_amount_mxn > v_price then
    raise exception 'La oferta no puede exceder el precio publicado';
  end if;

  if p_conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.dress_id = p_dress_id
      and c.buyer_id = v_buyer
      and c.seller_id = v_seller
  ) then
    raise exception 'La conversación no corresponde a esta operación';
  end if;

  if exists (
    select 1 from public.offers o
    where o.dress_id = p_dress_id
      and o.buyer_id = v_buyer
      and o.status = 'pending'
      and o.expires_at > now()
  ) then
    raise exception 'Ya existe una oferta activa para este vestido';
  end if;

  insert into public.offers(
    dress_id, conversation_id, buyer_id, seller_id,
    created_by, amount_mxn, status, expires_at, note
  )
  values (
    p_dress_id, p_conversation_id, v_buyer, v_seller,
    v_buyer, p_amount_mxn, 'pending', now() + interval '48 hours', p_note
  )
  returning id into v_offer;

  insert into public.offer_events(offer_id, actor_id, event_type)
  values (v_offer, v_buyer, 'created');

  return v_offer;
end;
$$;

revoke all on function public.create_offer(uuid, integer, uuid, text) from public;
grant execute on function public.create_offer(uuid, integer, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 5) Contraoferta
-- Crea una NUEVA fila; no borra el historial de negociación.
-- Solo puede contraofertar la contraparte de quien creó la oferta vigente.
-- ------------------------------------------------------------
create or replace function public.counter_offer(
  p_offer_id uuid,
  p_amount_mxn integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offers;
  v_actor uuid := auth.uid();
  v_new_offer uuid;
  v_price integer;
begin
  perform public.expire_stale_offers();

  select * into o
  from public.offers
  where id = p_offer_id
  for update;

  if o.id is null or o.status <> 'pending' or o.expires_at <= now() then
    raise exception 'La oferta ya no está disponible';
  end if;

  if v_actor not in (o.buyer_id, o.seller_id) then
    raise exception 'No autorizado';
  end if;

  if o.created_by = v_actor then
    raise exception 'Debes esperar la respuesta de la contraparte';
  end if;

  if p_amount_mxn is null or p_amount_mxn <= 0 then
    raise exception 'Monto inválido';
  end if;

  select precio_venta_mxn into v_price
  from public.dresses
  where id = o.dress_id;

  if p_amount_mxn > v_price then
    raise exception 'La contraoferta no puede exceder el precio publicado';
  end if;

  update public.offers
  set status = 'countered',
      responded_at = now(),
      updated_at = now()
  where id = o.id;

  insert into public.offer_events(offer_id, actor_id, event_type)
  values (o.id, v_actor, 'countered');

  insert into public.offers(
    dress_id, conversation_id, buyer_id, seller_id,
    parent_offer_id, created_by, amount_mxn,
    status, expires_at, note
  )
  values (
    o.dress_id, o.conversation_id, o.buyer_id, o.seller_id,
    o.id, v_actor, p_amount_mxn,
    'pending', now() + interval '48 hours', p_note
  )
  returning id into v_new_offer;

  insert into public.offer_events(offer_id, actor_id, event_type)
  values (v_new_offer, v_actor, 'created');

  return v_new_offer;
end;
$$;

revoke all on function public.counter_offer(uuid, integer, text) from public;
grant execute on function public.counter_offer(uuid, integer, text) to authenticated;

-- ------------------------------------------------------------
-- 6) Rechazar/cancelar
-- ------------------------------------------------------------
create or replace function public.decline_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offers;
  v_actor uuid := auth.uid();
begin
  select * into o from public.offers where id = p_offer_id for update;

  if o.id is null or o.status <> 'pending' then
    raise exception 'Oferta no disponible';
  end if;

  if v_actor not in (o.buyer_id, o.seller_id) then
    raise exception 'No autorizado';
  end if;

  if o.created_by = v_actor then
    update public.offers
    set status='cancelled', cancelled_at=now(), responded_at=now(), updated_at=now()
    where id=o.id;

    insert into public.offer_events(offer_id,actor_id,event_type)
    values(o.id,v_actor,'cancelled');
  else
    update public.offers
    set status='rejected', responded_at=now(), updated_at=now()
    where id=o.id;

    insert into public.offer_events(offer_id,actor_id,event_type)
    values(o.id,v_actor,'rejected');
  end if;
end;
$$;

revoke all on function public.decline_offer(uuid) from public;
grant execute on function public.decline_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7) Aceptar oferta
-- Puede aceptar únicamente la contraparte de quien creó la oferta.
-- Crea el pedido y reserva el vestido.
-- ------------------------------------------------------------
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offers;
  v_actor uuid := auth.uid();
  v_order uuid;
  v_commission integer;
begin
  perform public.expire_stale_offers();

  select * into o
  from public.offers
  where id = p_offer_id
  for update;

  if o.id is null or o.status <> 'pending' or o.expires_at <= now() then
    raise exception 'Oferta no disponible';
  end if;

  if v_actor not in (o.buyer_id, o.seller_id) then
    raise exception 'No autorizado';
  end if;

  if o.created_by = v_actor and not public.is_admin() then
    raise exception 'No puedes aceptar tu propia oferta';
  end if;

  if not exists (
    select 1 from public.dresses d
    where d.id = o.dress_id
      and d.status = 'approved'
  ) then
    raise exception 'El vestido ya no está disponible';
  end if;

  -- Comisión provisional del 15%. 0010 toma el snapshot definitivo y agrega
  -- el cargo administrativo fijo antes de iniciar Checkout.
  v_commission := round(o.amount_mxn * 0.15);

  update public.offers
  set status='accepted', accepted_at=now(), responded_at=now(), updated_at=now()
  where id=o.id;

  update public.offers
  set status='rejected', responded_at=now(), updated_at=now()
  where dress_id=o.dress_id
    and id<>o.id
    and status='pending';

  update public.dresses
  set status='reserved'
  where id=o.dress_id;

  insert into public.orders(
    dress_id, offer_id, buyer_id, seller_id,
    subtotal_mxn, commission_mxn, total_mxn, seller_net_mxn,
    status
  )
  values(
    o.dress_id, o.id, o.buyer_id, o.seller_id,
    o.amount_mxn, v_commission, o.amount_mxn, o.amount_mxn-v_commission,
    'awaiting_payment'
  )
  returning id into v_order;

  insert into public.offer_events(offer_id, actor_id, event_type)
  values(o.id, v_actor, 'accepted');

  return v_order;
end;
$$;

revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- 8) RLS y permisos: los cambios sensibles pasan por RPC.
-- ------------------------------------------------------------
alter table public.offer_events enable row level security;

drop policy if exists "parties read offer events" on public.offer_events;
create policy "parties read offer events"
  on public.offer_events for select to authenticated
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_id
        and (auth.uid() in (o.buyer_id,o.seller_id) or public.is_admin())
    )
  );

-- Conservamos lectura de offers; retiramos INSERT/UPDATE directos del navegador.
drop policy if exists "buyer creates offer" on public.offers;
drop policy if exists "parties update offers" on public.offers;

revoke insert, update on public.offers from authenticated;
revoke all on public.offer_events from anon, authenticated;
grant select on public.offer_events to authenticated;

commit;
