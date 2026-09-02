-- SECOND VOW 0024 — experiencia unificada, eliminación visible y avisos de mejora.
-- Compatible con Vercel Hobby: la bandeja detecta pendientes aunque el cron diario aún no corra.
begin;

alter table public.dresses add column if not exists removed_by_seller_at timestamptz;
alter table public.notifications add column if not exists dress_id uuid references public.dresses(id) on delete set null;
create index if not exists notifications_dress_user_idx on public.notifications(dress_id,user_id,created_at desc);

-- Solo las sugerencias vinculadas a vestidos ya publicados son visibles para
-- poder mostrar "marca en confirmación" en el catálogo público.
grant select on public.brand_suggestions to anon;
drop policy if exists "public reads pending brand of published dress" on public.brand_suggestions;
create policy "public reads pending brand of published dress" on public.brand_suggestions for select to anon
using(exists(select 1 from public.dresses d where d.brand_suggestion_id=brand_suggestions.id and d.status='approved'));

-- Varias ofertas aceptadas pueden coexistir. Ninguna reserva el vestido.
drop index if exists public.orders_one_active_checkout_per_dress;
create or replace function public.accept_offer(p_offer_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.offers; v_order uuid; v_commission integer;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null or o.status<>'pending' or o.expires_at<now() then raise exception 'Oferta no disponible'; end if;
  if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.dresses d where d.id=o.dress_id and d.status<>'approved') then raise exception 'El vestido ya no está disponible'; end if;
  v_commission:=round(o.amount_mxn*.18);
  update public.offers set status='accepted',accepted_at=now(),updated_at=now() where id=o.id;
  insert into public.orders(dress_id,offer_id,buyer_id,seller_id,subtotal_mxn,commission_mxn,total_mxn,seller_net_mxn,payment_deadline_at)
  values(o.dress_id,o.id,o.buyer_id,o.seller_id,o.amount_mxn,v_commission,o.amount_mxn,o.amount_mxn-v_commission,now()+interval '48 hours') returning id into v_order;
  return v_order;
end$$;
revoke all on function public.accept_offer(uuid) from public; grant execute on function public.accept_offer(uuid) to authenticated;

create or replace function public.backend_begin_checkout(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders; d public.dresses;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.status<>'awaiting_payment' then raise exception 'El pedido ya no puede iniciar pago'; end if;
  if o.payment_deadline_at is not null and o.payment_deadline_at<now() then raise exception 'El plazo para pagar venció'; end if;
  select * into d from public.dresses where id=o.dress_id;
  if d.id is null or d.status<>'approved' then raise exception 'El vestido ya no está disponible'; end if;
  update public.orders set status='payment_processing',stripe_checkout_session_id=null,updated_at=now() where id=o.id returning * into o;
  return o;
end$$;
revoke all on function public.backend_begin_checkout(uuid) from public;

-- Envuelve la confirmación existente con un bloqueo por vestido: primera compra pagada gana.
alter function public.backend_mark_payment_paid(uuid,text,text,text,integer,integer,text) rename to backend_mark_payment_paid_legacy;
alter table public.dresses add column if not exists winning_order_id uuid references public.orders(id) on delete set null;
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
    update public.orders set status='cancelled',payment_failure_code='another_buyer_paid_first',updated_at=now() where dress_id=v_dress and id<>p_order_id and status='awaiting_payment';
    update public.offers set status='rejected',updated_at=now() where dress_id=v_dress and id<>(select offer_id from public.orders where id=p_order_id) and status in('pending','accepted');
  elsif v_result='paid' and v_winner is not null and v_winner<>p_order_id then
    update public.orders set status='payment_review',updated_at=now() where id=p_order_id;
    insert into public.payment_exceptions(order_id,payment_intent_id,checkout_session_id,exception_type,details)
    values(p_order_id,p_payment_intent_id,p_checkout_session_id,'dress_no_longer_available','{}') on conflict do nothing;
    v_result:='payment_review';
  end if;
  return v_result;
end$$;
revoke all on function public.backend_mark_payment_paid(uuid,text,text,text,integer,integer,text) from public;

create or replace function public.remove_own_dress_listing(p_dress_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare d public.dresses; v_history boolean;
begin
  select * into d from public.dresses where id=p_dress_id for update;
  if d.id is null or d.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if d.status in('reserved','sold') or exists(select 1 from public.orders o where o.dress_id=d.id and o.status not in('cancelled','refunded','completed')) then
    raise exception 'No puedes eliminar una publicación con una operación activa';
  end if;
  select exists(select 1 from public.orders o where o.dress_id=d.id) into v_history;
  if v_history then
    update public.dresses set status='archived',removed_by_seller_at=now(),updated_at=now() where id=d.id;
    return 'removed_preserving_history';
  end if;
  delete from public.dresses where id=d.id;
  return 'deleted';
end$$;
revoke all on function public.remove_own_dress_listing(uuid) from public;
grant execute on function public.remove_own_dress_listing(uuid) to authenticated;

create or replace function public.admin_suggest_dress_changes(p_dress_id uuid,p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.dresses; v_id uuid; v_message text:=nullif(btrim(coalesce(p_message,'')),'');
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if v_message is null or length(v_message)<10 then raise exception 'Escribe una sugerencia clara'; end if;
  select * into d from public.dresses where id=p_dress_id;
  if d.id is null then raise exception 'Publicación inexistente'; end if;
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata,email_status)
  values(d.seller_id,d.id,'dress_improvement_suggested','Sugerencia para mejorar tu publicación',v_message,jsonb_build_object('dress_id',d.id),'pending') returning id into v_id;
  return v_id;
end$$;
revoke all on function public.admin_suggest_dress_changes(uuid,text) from public;
grant execute on function public.admin_suggest_dress_changes(uuid,text) to authenticated;

create or replace function public.admin_resolve_brand_suggestion_v2(p_suggestion_id uuid,p_action text,p_existing_brand_id uuid default null,p_notes text default null,p_corrected_name text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ids uuid[]; v_brand uuid; v_published integer:=0;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into v_ids from public.dresses where brand_suggestion_id=p_suggestion_id;
  v_brand:=public.admin_resolve_brand_suggestion(p_suggestion_id,p_action,p_existing_brand_id,p_notes,p_corrected_name);
  if cardinality(v_ids)>0 then select count(*) into v_published from public.dresses where id=any(v_ids) and status='approved'; end if;
  return jsonb_build_object('brand_id',v_brand,'linked_dresses',cardinality(v_ids),'published_dresses',v_published);
end$$;
revoke all on function public.admin_resolve_brand_suggestion_v2(uuid,text,uuid,text,text) from public;
grant execute on function public.admin_resolve_brand_suggestion_v2(uuid,text,uuid,text,text) to authenticated;

create or replace function public.admin_list_pending_items()
returns table(tipo text,etiqueta text,url text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'No autorizado'; end if;
 return query
 select 'marca', 'Confirmar marca: '||bs.suggested_name, '/admin#marcas', bs.created_at from public.brand_suggestions bs where bs.status='pending'
 union all select 'borrador', 'Borrador incompleto: '||coalesce(d.model,'sin modelo'), '/admin/publicaciones/'||d.id::text, d.updated_at from public.dresses d where d.status in('draft','pending_review') and d.updated_at>now()-interval '365 days'
 union all select 'pedido_vencido', 'Pedido vencido sin cerrar: '||coalesce(o.public_code,o.id::text), '/admin#pedidos', o.updated_at from public.orders o where o.status in('awaiting_payment','payment_processing') and o.payment_deadline_at<now()
 union all select 'pago', 'Excepción de pago: '||pe.exception_type, '/admin#pagos', pe.created_at from public.payment_exceptions pe where pe.status='open'
 union all select 'cancelacion', 'Cancelación o pago fallido: '||coalesce(o.public_code,o.id::text), '/admin#pedidos', o.updated_at from public.orders o where o.payment_failure_code is not null and o.updated_at>now()-interval '14 days'
 union all select 'reclamacion', 'Reclamación abierta', '/admin#reclamaciones', c.created_at from public.claims c where c.status in('open','under_review','refund_pending')
 order by created_at asc;
end$$;
revoke all on function public.admin_list_pending_items() from public;
grant execute on function public.admin_list_pending_items() to authenticated;

commit;
