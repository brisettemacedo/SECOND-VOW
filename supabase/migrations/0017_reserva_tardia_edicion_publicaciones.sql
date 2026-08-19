-- SECOND VOW 0017 — reserva tardía, edición/eliminación de publicaciones,
-- expiración de pagos abandonados y visibilidad correcta por estado.
begin;

-- ------------------------------------------------------------
-- 1) La aceptación de una oferta YA NO reserva el vestido.
--    El vestido permanece 'approved' (visible, puede recibir otras ofertas)
--    mientras el pedido está 'awaiting_payment'.
-- ------------------------------------------------------------
create or replace function public.accept_offer(p_offer_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.offers; v_order uuid; v_commission integer;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null then raise exception 'Oferta inexistente'; end if;
  if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if o.status<>'pending' or o.expires_at<now() then raise exception 'Oferta no disponible'; end if;
  v_commission:=round(o.amount_mxn*.05);
  update public.offers set status='accepted',updated_at=now() where id=o.id;
  update public.offers set status='rejected',updated_at=now() where dress_id=o.dress_id and id<>o.id and status='pending';
  -- El vestido se marca 'reserved' hasta que la compradora inicie el pago
  -- (ver /api/stripe/checkout), no en este punto.
  insert into public.orders(dress_id,offer_id,buyer_id,seller_id,subtotal_mxn,commission_mxn,total_mxn,seller_net_mxn,payment_deadline_at)
  values(o.dress_id,o.id,o.buyer_id,o.seller_id,o.amount_mxn,v_commission,o.amount_mxn,o.amount_mxn-v_commission,now()+interval '24 hours')
  returning id into v_order;
  return v_order;
end$$;
grant execute on function public.accept_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) Reservar el vestido justo cuando arranca el checkout (pago en curso),
--    y liberarlo si el pago se cancela o se abandona.
-- ------------------------------------------------------------
create or replace function public.backend_mark_payment_processing(p_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_dress uuid; v_status text;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select dress_id,status into v_dress,v_status from public.orders where id=p_order_id for update;
  if v_dress is null then raise exception 'Pedido inexistente'; end if;
  if v_status<>'awaiting_payment' then raise exception 'El pedido no está esperando pago'; end if;
  update public.orders set status='payment_processing',payment_deadline_at=now()+interval '60 minutes',updated_at=now() where id=p_order_id;
  update public.dresses set status='reserved' where id=v_dress and status='approved';
end$$;
revoke all on function public.backend_mark_payment_processing(uuid) from public;

create or replace function public.cancel_stale_checkout(p_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.buyer_id<>auth.uid() and auth.role()<>'service_role' and not public.is_admin() then raise exception 'No autorizado'; end if;
  if o.status<>'payment_processing' then return; end if;
  update public.orders set status='cancelled',updated_at=now() where id=o.id;
  update public.dresses set status='approved' where id=o.dress_id and status='reserved';
end$$;
grant execute on function public.cancel_stale_checkout(uuid) to authenticated;

-- Red de seguridad: libera reservas de pagos abandonados (nadie completó el
-- checkout ni volvió a cancelarlo explícitamente). Se ejecuta por cron.
create or replace function public.backend_expire_abandoned_payments() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  with stale as (
    update public.orders
    set status='cancelled', updated_at=now()
    where status='payment_processing'
      and payment_deadline_at < now()
    returning dress_id
  )
  update public.dresses d set status='approved'
  from stale s where d.id=s.dress_id and d.status='reserved';
  get diagnostics v_count = row_count;

  -- Ofertas aceptadas cuyo pedido nunca inició el pago en 24h: se cancelan
  -- y el vestido (si seguía 'approved', no cambia nada) queda libre igual.
  update public.orders set status='cancelled', updated_at=now()
  where status='awaiting_payment' and payment_deadline_at < now();

  return v_count;
end$$;
revoke all on function public.backend_expire_abandoned_payments() from public;

-- ------------------------------------------------------------
-- 3) Editar / eliminar publicaciones mientras no haya una oferta aceptada
--    (es decir, mientras no exista un pedido activo sobre el vestido).
-- ------------------------------------------------------------
create or replace function public.dress_has_active_order(p_dress_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.orders
    where dress_id = p_dress_id
      and status in ('awaiting_payment','payment_processing')
  )
$$;
grant execute on function public.dress_has_active_order(uuid) to authenticated, anon;

create or replace function public.dress_has_any_order(p_dress_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.orders where dress_id = p_dress_id)
$$;
grant execute on function public.dress_has_any_order(uuid) to authenticated;

create or replace function public.enforce_dress_update_security()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := auth.role();
  privileged boolean :=
    current_user in ('postgres', 'supabase_admin', 'service_role')
    or actor_role = 'service_role'
    or public.is_admin();
begin
  if privileged then
    return new;
  end if;

  if actor is null or old.seller_id <> actor or new.seller_id <> old.seller_id then
    raise exception 'No autorizado para modificar este vestido';
  end if;

  if not public.is_active_user() then
    raise exception 'La cuenta está bloqueada';
  end if;

  if old.status not in ('draft', 'pending_review', 'changes_requested', 'rejected', 'approved') then
    raise exception 'El vestido no puede editarse en su estado actual';
  end if;

  if public.dress_has_active_order(old.id) then
    raise exception 'No puedes editar este vestido: ya tiene una oferta aceptada con un pedido en curso';
  end if;

  if new.status not in ('draft', 'pending_review', 'changes_requested', 'rejected', 'archived', 'approved') then
    raise exception 'Transición de estado no permitida para la vendedora';
  end if;

  if new.moderation_notes is distinct from old.moderation_notes
     or new.moderated_by is distinct from old.moderated_by
     or new.moderated_at is distinct from old.moderated_at
     or new.published_at is distinct from old.published_at then
    raise exception 'Los campos de moderación solo pueden modificarse por administración';
  end if;

  return new;
end;
$$;

-- Al reenviar a revisión un vestido que ya estaba publicado, vuelve a
-- 'pending_review' (se revisa el cambio antes de publicarse de nuevo).
-- Esto ya ocurre porque DressPublishForm hace update({status:'pending_review'}).

drop policy if exists "vendedora borra borrador propio" on public.dresses;
drop policy if exists "vendedora elimina publicacion propia sin pedido activo" on public.dresses;
create policy "vendedora elimina publicacion propia sin pedido activo"
  on public.dresses
  for delete
  to authenticated
  using (
    seller_id = auth.uid()
    and public.is_active_user()
    and status in ('draft', 'pending_review', 'changes_requested', 'rejected', 'approved')
    and not public.dress_has_any_order(id)
  );

-- Autocuración: cualquier visita a la ficha de un vestido "reservado" puede
-- liberarlo al instante si el pago ya se pasó de tiempo, sin depender del
-- cron (que en el plan Hobby de Vercel solo corre una vez al día).
create or replace function public.expire_dress_reservation_if_stale(p_dress_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_order_id uuid;
begin
  select id into v_order_id from public.orders
  where dress_id = p_dress_id and status = 'payment_processing' and payment_deadline_at < now()
  limit 1 for update skip locked;
  if v_order_id is null then return; end if;
  update public.orders set status='cancelled', updated_at=now() where id=v_order_id;
  update public.dresses set status='approved' where id=p_dress_id and status='reserved';
end$$;
grant execute on function public.expire_dress_reservation_if_stale(uuid) to authenticated, anon;

commit;
