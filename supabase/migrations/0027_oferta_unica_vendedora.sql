-- ============================================================
-- SECOND VOW 0027 — Modelo de oferta única de la vendedora
-- Ejecutar DESPUÉS de 0026.
-- ============================================================
begin;

-- ------------------------------------------------------------
-- 1) La oferta ahora incluye el envío como parte del monto
-- ------------------------------------------------------------
alter table public.offers
  add column if not exists shipping_mxn integer not null default 0
  check (shipping_mxn >= 0);

comment on column public.offers.amount_mxn is 'Precio del vestido en la oferta (sin envío). El total que paga la compradora es amount_mxn + shipping_mxn.';
comment on column public.offers.shipping_mxn is 'Costo de envío ya incluido y cotizado por la vendedora al momento de ofertar.';

-- ------------------------------------------------------------
-- 2) Nueva create_offer: SOLO la vendedora puede crear una oferta,
--    y debe declarar el envío. Ya no se permite que la compradora
--    inicie una oferta formal (puede seguir negociando por chat,
--    pero eso no genera un compromiso de tiempo ni de pago).
-- ------------------------------------------------------------
create or replace function public.create_offer(
  p_dress_id uuid,
  p_amount_mxn integer,
  p_shipping_mxn integer,
  p_conversation_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid := auth.uid();
  v_dress_seller uuid;
  v_buyer uuid;
  v_price integer;
  v_offer uuid;
begin
  if p_amount_mxn is null or p_amount_mxn <= 0 then
    raise exception 'Monto inválido';
  end if;
  if p_shipping_mxn is null or p_shipping_mxn < 0 then
    raise exception 'Costo de envío inválido';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'La nota es demasiado larga';
  end if;

  perform public.expire_stale_offers();

  select seller_id, precio_venta_mxn into v_dress_seller, v_price
  from public.dresses
  where id = p_dress_id and status = 'approved'
  for update;

  if v_dress_seller is null then
    raise exception 'Vestido no disponible';
  end if;

  if v_dress_seller <> v_seller then
    raise exception 'Solo la vendedora puede enviar una oferta';
  end if;

  if p_amount_mxn > v_price then
    raise exception 'La oferta no puede exceder el precio publicado';
  end if;

  select buyer_id into v_buyer
  from public.conversations
  where id = p_conversation_id and dress_id = p_dress_id and seller_id = v_seller;

  if v_buyer is null then
    raise exception 'La conversación no corresponde a esta operación';
  end if;

  if exists (
    select 1 from public.offers o
    where o.dress_id = p_dress_id
      and o.buyer_id = v_buyer
      and o.status = 'pending'
      and o.expires_at > now()
  ) then
    raise exception 'Ya hay una oferta activa para esta compradora sobre este vestido';
  end if;

  insert into public.offers(
    dress_id, conversation_id, buyer_id, seller_id,
    created_by, amount_mxn, shipping_mxn, status, expires_at, note
  )
  values (
    p_dress_id, p_conversation_id, v_buyer, v_seller,
    v_seller, p_amount_mxn, p_shipping_mxn, 'pending', now() + interval '48 hours', p_note
  )
  returning id into v_offer;

  insert into public.offer_events(offer_id, actor_id, event_type)
  values (v_offer, v_seller, 'created');

  return v_offer;
end;
$$;

revoke all on function public.create_offer(uuid, integer, integer, uuid, text) from public;
grant execute on function public.create_offer(uuid, integer, integer, uuid, text) to authenticated;

-- La firma anterior (sin envío) queda inutilizada a propósito, para que
-- cualquier código viejo que la siga llamando falle de forma clara en
-- vez de crear ofertas sin envío por accidente.
drop function if exists public.create_offer(uuid, integer, uuid, text);

-- ------------------------------------------------------------
-- 3) Contraoferta: eliminada. Si la oferta vence sin pago, la
--    compradora debe pedir por chat que se reenvíe (una nueva
--    llamada a create_offer), no negociar un monto distinto aquí.
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
begin
  raise exception 'Ya no se permiten contraofertas. Pide a la vendedora por chat que reenvíe su oferta.';
end;
$$;

-- ------------------------------------------------------------
-- 4) Corrige el bug real: ahora que SOLO la vendedora crea ofertas,
--    quien debe poder aceptarlas es la COMPRADORA — nunca al revés,
--    y nunca "quien no la creó" de forma genérica (eso era el parche
--    de counter_offer, ya no aplica porque no hay contraofertas).
-- ------------------------------------------------------------
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offers;
  v_order uuid;
  v_commission integer;
  v_total integer;
begin
  select * into o from public.offers where id = p_offer_id for update;

  if o.id is null or o.status <> 'pending' or o.expires_at < now() then
    raise exception 'Oferta no disponible';
  end if;

  if o.buyer_id <> auth.uid() and not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if exists (
    select 1 from public.dresses d
    where d.id = o.dress_id and d.status <> 'approved'
  ) then
    raise exception 'El vestido ya no está disponible';
  end if;

  v_total := o.amount_mxn + o.shipping_mxn;
  -- Decisión de negocio: el 18% se calcula sobre vestido + envío juntos.
  v_commission := round(v_total * 0.18);

  update public.offers set status = 'accepted', accepted_at = now(), updated_at = now() where id = o.id;

  insert into public.orders(
    dress_id, offer_id, buyer_id, seller_id,
    subtotal_mxn, shipping_mxn, commission_mxn, total_mxn, seller_net_mxn,
    shipping_quote_set_at, payment_deadline_at
  )
  values (
    o.dress_id, o.id, o.buyer_id, o.seller_id,
    o.amount_mxn, o.shipping_mxn, v_commission, v_total, v_total - v_commission,
    now(), now() + interval '48 hours'
    -- seller_ship_by NO se fija aquí a propósito: backend_mark_payment_paid()
    -- ya lo establece correctamente cuando el pago se confirma de verdad
    -- (el plazo de envío no debe correr si la compradora nunca pagó).
  )
  returning id into v_order;

  return v_order;
end;
$$;

revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5) decline_offer: ahora solo la compradora puede rechazar una
--    oferta (antes cualquiera de las dos partes podía).
-- ------------------------------------------------------------
create or replace function public.decline_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if o.id is null or o.status <> 'pending' then
    raise exception 'Oferta no disponible';
  end if;
  if o.buyer_id <> auth.uid() and not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  update public.offers set status = 'declined', responded_at = now(), updated_at = now() where id = o.id;
end;
$$;

revoke all on function public.decline_offer(uuid) from public;
grant execute on function public.decline_offer(uuid) to authenticated;

commit;
