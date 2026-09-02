-- SECOND VOW 0028 — piloto: oferta final, checkout reintentable y consentimiento de imagen
-- Ejecutar DESPUÉS de 0027.
begin;

alter table public.conversations add column if not exists buyer_postal_code text;
alter table public.conversations drop constraint if exists conversations_buyer_postal_code_check;
alter table public.conversations add constraint conversations_buyer_postal_code_check
  check (buyer_postal_code is null or buyer_postal_code ~ '^[0-9]{5}$');

alter table public.orders add column if not exists checkout_expires_at timestamptz;
alter table public.dress_declarations add column if not exists promotional_image_license_declared boolean not null default false;
alter table public.dress_declarations add column if not exists promotional_image_license_declared_at timestamptz;

create or replace function public.set_conversation_postal_code(p_conversation_id uuid,p_postal_code text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.conversations; v_cp text:=regexp_replace(coalesce(p_postal_code,''),'[^0-9]','','g');
begin
  select * into c from public.conversations where id=p_conversation_id for update;
  if c.id is null or c.buyer_id<>auth.uid() then raise exception 'Solo la compradora puede registrar su código postal'; end if;
  if v_cp!~'^[0-9]{5}$' then raise exception 'Ingresa un código postal de 5 dígitos'; end if;
  update public.conversations set buyer_postal_code=v_cp where id=c.id;
end$$;
revoke all on function public.set_conversation_postal_code(uuid,text) from public;
grant execute on function public.set_conversation_postal_code(uuid,text) to authenticated;

create or replace function public.create_offer(p_dress_id uuid,p_amount_mxn integer,p_shipping_mxn integer,p_conversation_id uuid default null,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_seller uuid:=auth.uid(); d public.dresses; c public.conversations; v_offer uuid;
begin
  if v_seller is null or not public.is_active_user() then raise exception 'Cuenta no disponible'; end if;
  if p_amount_mxn is null or p_amount_mxn<=0 then raise exception 'Monto inválido'; end if;
  if p_shipping_mxn is null or p_shipping_mxn<0 then raise exception 'Costo de envío inválido'; end if;
  if char_length(coalesce(p_note,''))>500 then raise exception 'La nota es demasiado larga'; end if;
  perform public.expire_stale_offers();
  select * into d from public.dresses where id=p_dress_id and status='approved' for update;
  if d.id is null then raise exception 'Vestido no disponible'; end if;
  if d.seller_id<>v_seller then raise exception 'Solo la vendedora puede enviar una oferta'; end if;
  if p_amount_mxn>d.precio_venta_mxn then raise exception 'La oferta no puede exceder el precio publicado'; end if;
  select * into c from public.conversations where id=p_conversation_id and dress_id=d.id and seller_id=v_seller;
  if c.id is null then raise exception 'La conversación no corresponde a esta operación'; end if;
  if c.buyer_postal_code is null then raise exception 'La compradora debe registrar su código postal antes de recibir una oferta'; end if;
  if exists(select 1 from public.offers where conversation_id=c.id and status='pending' and expires_at>now()) then raise exception 'Ya hay una oferta vigente en esta conversación'; end if;
  if exists(select 1 from public.orders where dress_id=d.id and buyer_id=c.buyer_id and seller_id=c.seller_id and status not in('cancelled','refunded','completed')) then raise exception 'Ya existe un pedido activo en esta conversación'; end if;
  insert into public.offers(dress_id,conversation_id,buyer_id,seller_id,created_by,amount_mxn,shipping_mxn,status,expires_at,note)
  values(d.id,c.id,c.buyer_id,c.seller_id,v_seller,p_amount_mxn,p_shipping_mxn,'pending',now()+interval '48 hours',nullif(btrim(p_note),'')) returning id into v_offer;
  insert into public.offer_events(offer_id,actor_id,event_type) values(v_offer,v_seller,'created');
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata)
  values(c.buyer_id,d.id,'offer_received','Recibiste una oferta','La vendedora te envió una oferta final con envío incluido. Tienes 48 horas para aceptarla.',jsonb_build_object('offer_id',v_offer,'conversation_id',c.id));
  return v_offer;
end$$;
revoke all on function public.create_offer(uuid,integer,integer,uuid,text) from public;
grant execute on function public.create_offer(uuid,integer,integer,uuid,text) to authenticated;

create or replace function public.accept_offer(p_offer_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.offers; v_order uuid; v_total integer; v_commission integer;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null or o.status<>'pending' or o.expires_at<=now() then raise exception 'Oferta no disponible'; end if;
  if o.buyer_id<>auth.uid() then raise exception 'Solo la compradora puede aceptar esta oferta'; end if;
  if not public.is_active_user() then raise exception 'Cuenta no disponible'; end if;
  perform 1 from public.dresses where id=o.dress_id and status='approved' for update;
  if not found then raise exception 'El vestido ya no está disponible'; end if;
  if exists(select 1 from public.orders where dress_id=o.dress_id and buyer_id=o.buyer_id and status not in('cancelled','refunded','completed')) then raise exception 'Ya existe un pedido activo para esta conversación'; end if;
  v_total:=o.amount_mxn+o.shipping_mxn; v_commission:=round(v_total*.18);
  update public.offers set status='accepted',accepted_at=now(),responded_at=now(),updated_at=now() where id=o.id;
  insert into public.offer_events(offer_id,actor_id,event_type) values(o.id,auth.uid(),'accepted');
  insert into public.orders(dress_id,offer_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,commission_mxn,total_mxn,seller_net_mxn,seller_transfer_mxn,shipping_quote_set_at,payment_deadline_at)
  values(o.dress_id,o.id,o.buyer_id,o.seller_id,o.amount_mxn,o.shipping_mxn,v_commission,v_total,v_total-v_commission,v_total-v_commission,now(),now()+interval '48 hours') returning id into v_order;
  insert into public.notifications(user_id,order_id,dress_id,kind,title,body) values(o.seller_id,v_order,o.dress_id,'offer_accepted','Oferta aceptada','La compradora aceptó tu oferta. Tiene 48 horas para completar el pago.');
  return v_order;
end$$;
revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

create or replace function public.decline_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.offers;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null or o.status<>'pending' then raise exception 'Oferta no disponible'; end if;
  if o.buyer_id<>auth.uid() then raise exception 'Solo la compradora puede rechazar esta oferta'; end if;
  update public.offers set status='rejected',responded_at=now(),updated_at=now() where id=o.id;
  insert into public.offer_events(offer_id,actor_id,event_type) values(o.id,auth.uid(),'rejected');
end$$;
revoke all on function public.decline_offer(uuid) from public;
grant execute on function public.decline_offer(uuid) to authenticated;

create or replace function public.cancel_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.offers;
begin
  select * into o from public.offers where id=p_offer_id for update;
  if o.id is null or o.status<>'pending' then raise exception 'La oferta ya no puede cancelarse'; end if;
  if o.seller_id<>auth.uid() then raise exception 'Solo la vendedora puede cancelar esta oferta'; end if;
  update public.offers set status='cancelled',cancelled_at=now(),responded_at=now(),updated_at=now() where id=o.id;
  insert into public.offer_events(offer_id,actor_id,event_type) values(o.id,auth.uid(),'cancelled');
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata) values(o.buyer_id,o.dress_id,'offer_cancelled','Oferta cancelada','La vendedora canceló la oferta pendiente.',jsonb_build_object('offer_id',o.id));
end$$;
revoke all on function public.cancel_offer(uuid) from public;
grant execute on function public.cancel_offer(uuid) to authenticated;

create or replace function public.backend_prepare_order_financials(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders; f public.marketplace_fee_configs; v_commission integer; v_buyer_fee integer; v_base integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.status<>'awaiting_payment' then raise exception 'El pedido no está pendiente de pago'; end if;
  if o.payment_deadline_at<=now() then raise exception 'El plazo para pagar venció'; end if;
  if o.shipping_quote_set_at is null then raise exception 'El envío debe estar definido en la oferta'; end if;
  select * into f from public.marketplace_fee_configs where is_active=true and effective_from<=now() and(effective_until is null or effective_until>now()) order by effective_from desc limit 1;
  if f.id is null then raise exception 'No existe configuración de tarifas activa'; end if;
  v_base:=o.subtotal_mxn+o.shipping_mxn;
  v_commission:=round(v_base*f.seller_commission_bps/10000.0);
  v_buyer_fee:=round(o.subtotal_mxn*f.buyer_protection_bps/10000.0)+f.buyer_protection_fixed_mxn;
  update public.orders set fee_config_id=f.id,seller_commission_bps=f.seller_commission_bps,buyer_protection_bps=f.buyer_protection_bps,
    commission_mxn=v_commission,seller_admin_fee_mxn=0,buyer_protection_fee_mxn=v_buyer_fee,
    seller_net_mxn=greatest(0,v_base-v_commission),seller_transfer_mxn=greatest(0,v_base-v_commission),
    total_mxn=v_base+v_buyer_fee,amount_charged_mxn=v_base+v_buyer_fee,updated_at=now()
  where id=o.id returning * into o; return o;
end$$;
revoke all on function public.backend_prepare_order_financials(uuid) from public;

create or replace function public.backend_begin_checkout(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.status<>'awaiting_payment' then raise exception 'El pedido ya no puede iniciar pago'; end if;
  if o.payment_deadline_at<=now() then raise exception 'El plazo para pagar venció'; end if;
  perform 1 from public.dresses where id=o.dress_id and status='approved' for update;
  if not found then raise exception 'El vestido ya no está disponible'; end if;
  update public.orders set status='payment_processing',checkout_expires_at=least(payment_deadline_at,now()+interval '60 minutes'),stripe_checkout_session_id=null,updated_at=now() where id=o.id returning * into o;
  return o;
end$$;
revoke all on function public.backend_begin_checkout(uuid) from public;

create or replace function public.backend_release_checkout(p_order_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.status<>'payment_processing' then return; end if;
  if o.payment_deadline_at>now() then
    update public.orders set status='awaiting_payment',checkout_expires_at=null,stripe_checkout_session_id=null,payment_failure_code=coalesce(nullif(p_reason,''),'checkout_released'),updated_at=now() where id=o.id;
  else
    update public.orders set status='cancelled',checkout_expires_at=null,payment_failure_code='payment_deadline_expired',cancelled_at=coalesce(cancelled_at,now()),updated_at=now() where id=o.id;
    perform public.backend_sync_offer_after_order_cancel(o.id,'expired');
  end if;
end$$;
revoke all on function public.backend_release_checkout(uuid,text) from public;

create or replace function public.set_order_shipping_quote(p_order_id uuid,p_shipping_mxn integer,p_carrier text default null)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'Solo la vendedora puede cotizar el envío'; end if;
  if o.status<>'awaiting_payment' then raise exception 'La cotización solo puede modificarse antes del pago'; end if;
  if p_shipping_mxn is null or p_shipping_mxn<0 then raise exception 'Costo de envío inválido'; end if;
  if o.offer_id is not null then raise exception 'El envío quedó fijado definitivamente en la oferta'; end if;
  update public.orders set shipping_mxn=p_shipping_mxn,shipping_carrier_declared=nullif(btrim(p_carrier),''),shipping_quote_set_at=now(),total_mxn=subtotal_mxn+p_shipping_mxn,updated_at=now() where id=o.id returning * into o;
  return o;
end$$;
revoke all on function public.set_order_shipping_quote(uuid,integer,text) from public;
grant execute on function public.set_order_shipping_quote(uuid,integer,text) to authenticated;

create unique index if not exists notifications_offer_reminder_unique
  on public.notifications(user_id,kind,((metadata->>'offer_id')))
  where kind in('offer_expires_12h','offer_expires_1h') and metadata ? 'offer_id';

create or replace function public.backend_generate_offer_reminders() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_rows integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  perform public.expire_stale_offers();
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata)
  select buyer_id,dress_id,'offer_expires_12h','Tu oferta vence pronto','Te quedan menos de 12 horas para aceptar la oferta y continuar al pago.',jsonb_build_object('offer_id',id,'conversation_id',conversation_id)
  from public.offers where status='pending' and expires_at>now()+interval '1 hour' and expires_at<=now()+interval '12 hours' on conflict do nothing;
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata)
  select buyer_id,dress_id,'offer_expires_1h','Última hora de la oferta','Te queda menos de 1 hora para aceptar la oferta.',jsonb_build_object('offer_id',id,'conversation_id',conversation_id)
  from public.offers where status='pending' and expires_at>now() and expires_at<=now()+interval '1 hour' on conflict do nothing;
  get diagnostics v_rows=row_count; return v_count+v_rows;
end$$;
revoke all on function public.backend_generate_offer_reminders() from public;

create or replace function public.refresh_my_offer_reminders() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_rows integer;
begin
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata)
  select buyer_id,dress_id,'offer_expires_12h','Tu oferta vence pronto','Te quedan menos de 12 horas para aceptar la oferta y continuar al pago.',jsonb_build_object('offer_id',id,'conversation_id',conversation_id)
  from public.offers where buyer_id=auth.uid() and status='pending' and expires_at>now()+interval '1 hour' and expires_at<=now()+interval '12 hours' on conflict do nothing;
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata)
  select buyer_id,dress_id,'offer_expires_1h','Última hora de la oferta','Te queda menos de 1 hora para aceptar la oferta.',jsonb_build_object('offer_id',id,'conversation_id',conversation_id)
  from public.offers where buyer_id=auth.uid() and status='pending' and expires_at>now() and expires_at<=now()+interval '1 hour' on conflict do nothing;
  get diagnostics v_rows=row_count; return v_count+v_rows;
end$$;
revoke all on function public.refresh_my_offer_reminders() from public;
grant execute on function public.refresh_my_offer_reminders() to authenticated;

commit;
