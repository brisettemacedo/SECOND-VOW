-- SECOND VOW 0025 — correcciones encontradas en la auditoría final v1.8.4.
begin;

-- La marca pendiente debe verse tanto sin sesión como con una sesión activa.
grant select on public.brand_suggestions to anon, authenticated;
drop policy if exists "public reads pending brand of published dress" on public.brand_suggestions;
create policy "public reads pending brand of published dress"
on public.brand_suggestions for select to anon, authenticated
using (
  exists (
    select 1 from public.dresses d
    where d.brand_suggestion_id=brand_suggestions.id
      and d.status='approved'
      and d.removed_by_seller_at is null
  )
  or seller_id=auth.uid()
  or public.is_admin()
);

-- Una oferta aceptada no bloquea la edición; un checkout iniciado sí.
create or replace function public.dress_has_active_order(p_dress_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.orders
    where dress_id=p_dress_id
      and status in ('payment_processing','payment_review')
  )
$$;
grant execute on function public.dress_has_active_order(uuid) to authenticated, anon;

-- Primera compra pagada gana: cancela dentro de la misma transacción todos
-- los pedidos sin pago, incluso los que ya tenían Checkout abierto.
create or replace function public.backend_mark_payment_paid(p_order_id uuid,p_payment_intent_id text,p_charge_id text,p_checkout_session_id text,p_processor_fee_mxn integer default null,p_amount_received_mxn integer default null,p_currency text default 'MXN')
returns text language plpgsql security definer set search_path='' as $$
declare v_dress uuid; v_winner uuid; v_result text;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select dress_id into v_dress from public.orders where id=p_order_id;
  if v_dress is null then raise exception 'Pedido inexistente'; end if;
  select winning_order_id into v_winner from public.dresses where id=v_dress for update;
  v_result:=public.backend_mark_payment_paid_legacy(p_order_id,p_payment_intent_id,p_charge_id,p_checkout_session_id,p_processor_fee_mxn,p_amount_received_mxn,p_currency);
  if v_result='paid' and v_winner is null then
    update public.dresses set status='sold',winning_order_id=p_order_id where id=v_dress;
    update public.orders
      set status='cancelled',payment_failure_code='another_buyer_paid_first',updated_at=now()
      where dress_id=v_dress and id<>p_order_id
        and status in('awaiting_payment','payment_processing');
    update public.offers set status='rejected',updated_at=now()
      where dress_id=v_dress
        and id<>(select offer_id from public.orders where id=p_order_id)
        and status in('pending','accepted');
  elsif v_result='paid' and v_winner is not null and v_winner<>p_order_id then
    update public.orders set status='payment_review',updated_at=now() where id=p_order_id;
    insert into public.payment_exceptions(order_id,payment_intent_id,checkout_session_id,exception_type,details)
      values(p_order_id,p_payment_intent_id,p_checkout_session_id,'dress_no_longer_available','{}')
      on conflict do nothing;
    v_result:='payment_review';
  end if;
  return v_result;
end$$;
revoke all on function public.backend_mark_payment_paid(uuid,text,text,text,integer,integer,text) from public;

-- Reporta únicamente vestidos que la función administrativa ya identificó
-- como estancados, no todos los borradores recientes.
create or replace function public.admin_list_pending_items()
returns table(tipo text,etiqueta text,url text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return query
  select 'marca', 'Confirmar marca: '||bs.suggested_name, '/admin#marcas', bs.created_at
    from public.brand_suggestions bs where bs.status='pending'
  union all
  select 'borrador', 'Borrador incompleto: '||coalesce(sd.model,'sin modelo'), '/admin/publicaciones/'||sd.id::text, sd.updated_at
    from public.admin_list_stalled_drafts() sd
  union all
  select 'pedido_vencido', 'Pedido vencido sin cerrar: '||coalesce(o.public_code,o.id::text), '/pedidos/'||o.id::text, o.updated_at
    from public.orders o where o.status in('awaiting_payment','payment_processing') and o.payment_deadline_at<now()
  union all
  select 'pago', 'Excepción de pago: '||pe.exception_type, '/admin#pagos', pe.created_at
    from public.payment_exceptions pe where pe.status='open'
  union all
  select 'cancelacion', 'Cancelación o pago fallido: '||coalesce(o.public_code,o.id::text), '/pedidos/'||o.id::text, o.updated_at
    from public.orders o where o.payment_failure_code is not null and o.updated_at>now()-interval '14 days'
  union all
  select 'reclamacion', 'Reclamación abierta', '/admin#reclamaciones', c.created_at
    from public.claims c where c.status in('open','under_review','refund_pending')
  order by created_at asc;
end$$;
revoke all on function public.admin_list_pending_items() from public;
grant execute on function public.admin_list_pending_items() to authenticated;

-- Cuenta solamente las publicaciones que pasaron a approved al resolver la marca.
create or replace function public.admin_resolve_brand_suggestion_v2(p_suggestion_id uuid,p_action text,p_existing_brand_id uuid default null,p_notes text default null,p_corrected_name text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ids uuid[]; v_candidates uuid[]; v_brand uuid; v_published integer:=0;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into v_ids
    from public.dresses where brand_suggestion_id=p_suggestion_id;
  select coalesce(array_agg(id),'{}'::uuid[]) into v_candidates
    from public.dresses where brand_suggestion_id=p_suggestion_id and status<>'approved';
  v_brand:=public.admin_resolve_brand_suggestion(p_suggestion_id,p_action,p_existing_brand_id,p_notes,p_corrected_name);
  if cardinality(v_candidates)>0 then
    select count(*) into v_published from public.dresses
      where id=any(v_candidates) and status='approved';
  end if;
  return jsonb_build_object('brand_id',v_brand,'linked_dresses',cardinality(v_ids),'published_dresses',v_published);
end$$;
revoke all on function public.admin_resolve_brand_suggestion_v2(uuid,text,uuid,text,text) from public;
grant execute on function public.admin_resolve_brand_suggestion_v2(uuid,text,uuid,text,text) to authenticated;

commit;
