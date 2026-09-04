-- SECOND VOW 0029: acciones de oferta inequívocas y nombres públicos seguros.
-- Ejecutar después de 0028.
begin;

-- Cierra ofertas vencidas y conserva solo la más reciente si datos históricos
-- dejaron más de una oferta pendiente en la misma conversación.
select public.expire_stale_offers();

with ranked as (
  select id,
    row_number() over (partition by conversation_id order by created_at desc, id desc) as position
  from public.offers
  where status = 'pending'
)
update public.offers o
set status = 'cancelled',
    cancelled_at = coalesce(o.cancelled_at, now()),
    responded_at = coalesce(o.responded_at, now()),
    updated_at = now()
from ranked r
where o.id = r.id and r.position > 1;

create unique index if not exists offers_one_pending_per_conversation_idx
  on public.offers (conversation_id)
  where status = 'pending';

create or replace function public.create_offer(
  p_dress_id uuid,
  p_amount_mxn integer,
  p_shipping_mxn integer,
  p_conversation_id uuid default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_seller uuid := auth.uid();
  d public.dresses;
  c public.conversations;
  v_offer uuid;
begin
  if v_seller is null or not public.is_active_user() then raise exception 'Cuenta no disponible'; end if;
  if p_amount_mxn is null or p_amount_mxn <= 0 then raise exception 'Monto inválido'; end if;
  if p_shipping_mxn is null or p_shipping_mxn < 0 then raise exception 'Costo de envío inválido'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'La nota es demasiado larga'; end if;

  perform public.expire_stale_offers();
  select * into d from public.dresses where id = p_dress_id and status = 'approved' for update;
  if d.id is null then raise exception 'Vestido no disponible'; end if;
  if d.seller_id <> v_seller then raise exception 'Solo la vendedora puede enviar una oferta'; end if;
  if p_amount_mxn > d.precio_venta_mxn then raise exception 'La oferta no puede exceder el precio publicado'; end if;

  select * into c from public.conversations
  where id = p_conversation_id and dress_id = d.id and seller_id = v_seller
  for update;
  if c.id is null then raise exception 'La conversación no corresponde a esta operación'; end if;
  if c.buyer_postal_code is null then raise exception 'La compradora debe registrar su código postal antes de recibir una oferta'; end if;
  if exists (select 1 from public.offers where conversation_id = c.id and status = 'pending') then
    raise exception 'Ya hay una oferta pendiente en esta conversación';
  end if;
  if exists (
    select 1 from public.orders
    where dress_id = d.id and buyer_id = c.buyer_id and seller_id = c.seller_id
      and status not in ('cancelled', 'refunded', 'completed')
  ) then raise exception 'Ya existe un pedido activo en esta conversación'; end if;

  insert into public.offers
    (dress_id, conversation_id, buyer_id, seller_id, created_by, amount_mxn, shipping_mxn, status, expires_at, note)
  values
    (d.id, c.id, c.buyer_id, c.seller_id, v_seller, p_amount_mxn, p_shipping_mxn, 'pending', now() + interval '48 hours', nullif(btrim(p_note), ''))
  returning id into v_offer;

  insert into public.offer_events (offer_id, actor_id, event_type) values (v_offer, v_seller, 'created');
  insert into public.notifications (user_id, dress_id, kind, title, body, metadata)
  values (c.buyer_id, d.id, 'offer_received', 'Recibiste una oferta',
    'La vendedora te envió una oferta con envío incluido. Tienes 48 horas para aceptarla.',
    jsonb_build_object('offer_id', v_offer, 'conversation_id', c.id));
  return v_offer;
exception
  when unique_violation then
    raise exception 'Ya hay una oferta pendiente en esta conversación';
end $$;

create or replace function public.accept_offer(p_offer_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.offers;
  v_order uuid;
  v_total integer;
  v_commission integer;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if o.id is null or o.status <> 'pending' then raise exception 'La oferta ya no está disponible'; end if;
  if o.expires_at <= now() then
    update public.offers set status = 'expired', responded_at = now(), updated_at = now() where id = o.id;
    raise exception 'La oferta venció. Puedes pedirle a la vendedora que te envíe otra';
  end if;
  if o.buyer_id <> auth.uid() then raise exception 'Solo la compradora puede aceptar esta oferta'; end if;
  if not public.is_active_user() then raise exception 'Cuenta no disponible'; end if;

  perform 1 from public.dresses where id = o.dress_id and status = 'approved' for update;
  if not found then raise exception 'El vestido ya no está disponible'; end if;

  select id into v_order from public.orders
  where offer_id = o.id and status not in ('cancelled', 'refunded', 'completed')
  order by created_at desc limit 1;
  if v_order is not null then return v_order; end if;

  if exists (
    select 1 from public.orders
    where dress_id = o.dress_id and buyer_id = o.buyer_id
      and status not in ('cancelled', 'refunded', 'completed')
  ) then raise exception 'Ya existe un pedido activo para esta conversación'; end if;

  v_total := o.amount_mxn + o.shipping_mxn;
  v_commission := round(v_total * 0.18);
  update public.offers set status = 'accepted', accepted_at = now(), responded_at = now(), updated_at = now() where id = o.id;
  insert into public.offer_events (offer_id, actor_id, event_type) values (o.id, auth.uid(), 'accepted');
  insert into public.orders
    (dress_id, offer_id, buyer_id, seller_id, status, subtotal_mxn, shipping_mxn, commission_mxn,
     total_mxn, seller_net_mxn, seller_transfer_mxn, shipping_quote_set_at, payment_deadline_at)
  values
    (o.dress_id, o.id, o.buyer_id, o.seller_id, 'awaiting_payment', o.amount_mxn, o.shipping_mxn,
     v_commission, v_total, v_total - v_commission, v_total - v_commission, now(), now() + interval '48 hours')
  returning id into v_order;
  insert into public.notifications (user_id, order_id, dress_id, kind, title, body)
  values (o.seller_id, v_order, o.dress_id, 'offer_accepted', 'Oferta aceptada',
    'La compradora aceptó tu oferta. Tiene 48 horas para completar el pago.');
  return v_order;
end $$;

create or replace function public.decline_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if o.id is null or o.status <> 'pending' then raise exception 'La oferta ya no está disponible'; end if;
  if o.buyer_id <> auth.uid() then raise exception 'Solo la compradora puede rechazar esta oferta'; end if;
  update public.offers set status = 'rejected', responded_at = now(), updated_at = now() where id = o.id;
  insert into public.offer_events (offer_id, actor_id, event_type) values (o.id, auth.uid(), 'rejected');
end $$;

create or replace function public.cancel_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if o.id is null then raise exception 'La oferta no existe'; end if;
  if o.seller_id <> auth.uid() then raise exception 'Solo la vendedora puede cancelar esta oferta'; end if;
  if o.status <> 'pending' then raise exception 'La oferta ya no puede cancelarse'; end if;
  update public.offers
  set status = 'cancelled', cancelled_at = now(), responded_at = now(), updated_at = now()
  where id = o.id;
  insert into public.offer_events (offer_id, actor_id, event_type) values (o.id, auth.uid(), 'cancelled');
  insert into public.notifications (user_id, dress_id, kind, title, body, metadata)
  values (o.buyer_id, o.dress_id, 'offer_cancelled', 'Oferta cancelada',
    'La vendedora canceló la oferta pendiente.', jsonb_build_object('offer_id', o.id));
end $$;

revoke all on function public.create_offer(uuid, integer, integer, uuid, text) from public;
revoke all on function public.accept_offer(uuid) from public;
revoke all on function public.decline_offer(uuid) from public;
revoke all on function public.cancel_offer(uuid) from public;
grant execute on function public.create_offer(uuid, integer, integer, uuid, text) to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;
grant execute on function public.cancel_offer(uuid) to authenticated;

-- El correo de autenticación sigue privado. Si alguien escribió un correo o una
-- URL como nombre visible, la vista pública no lo expone.
create or replace view public.public_profiles
with (security_barrier = true) as
select id, identity_verified, response_time_minutes, rating_average,
  case
    when nullif(btrim(full_name), '') is null then null
    when full_name like '%@%' then null
    when full_name ~* '^https?://' then null
    else btrim(full_name)
  end as display_name
from public.profiles
where is_blocked = false;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

notify pgrst, 'reload schema';
commit;
