-- SECOND VOW 0042 — reclamación clara, evidencia opcional y derecho de réplica
begin;

alter table public.claims
  add column if not exists seller_response_due_at timestamptz,
  add column if not exists seller_responded_at timestamptz,
  add column if not exists return_label_deadline_at timestamptz,
  add column if not exists return_carrier text;

update public.claims
set seller_response_due_at=created_at+interval '3 days'
where seller_response_due_at is null
  and status in ('open','under_review','seller_response');

alter table public.order_evidence drop constraint if exists order_evidence_type_check;
alter table public.order_evidence add constraint order_evidence_type_check check(evidence_type in(
  'seller_pre_ship','seller_packed','seller_shipping_receipt','buyer_package_received',
  'buyer_unboxing','buyer_dress_received','buyer_return_packed','seller_return_received',
  'seller_claim_response','seller_return_label','other'
));

create or replace function public.open_order_claim(
  p_order_id uuid,
  p_reason_code text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  o public.orders;
  v_claim uuid;
  v_due timestamptz:=now()+interval '3 days';
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.platform_delivery_recorded_at is null then raise exception 'La entrega todavía no ha sido registrada por SECOND VOW'; end if;
  if now()>coalesce(o.dispute_deadline_at,o.platform_delivery_recorded_at+interval '48 hours') then raise exception 'El plazo de 48 horas venció y operó la aceptación automática'; end if;
  if p_reason_code not in('not_received','false_or_materially_incorrect','damaged_undisclosed') then raise exception 'Motivo de reclamación no cubierto'; end if;
  if char_length(btrim(coalesce(p_description,'')))<20 then raise exception 'Describe lo ocurrido con al menos 20 caracteres'; end if;
  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'Ya existe una reclamación activa'; end if;

  insert into public.claims(order_id,opened_by,reason,reason_code,description,status,seller_response_due_at)
  values(o.id,(select auth.uid()),p_reason_code,p_reason_code,btrim(p_description),'open',v_due)
  returning id into v_claim;

  update public.orders set status='claim_open',updated_at=now() where id=o.id;
  update public.seller_payouts set status='paused',updated_at=now()
  where order_id=o.id and status in('held','releasable','requested');

  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  values(o.seller_id,o.id,'claim_opened','La compradora abrió una reclamación',
    'El saldo está protegido. Revisa lo reportado y responde desde el pedido dentro de tres días naturales. Puedes explicar tu versión y adjuntar evidencia si la tienes.',
    jsonb_build_object('claim_id',v_claim,'seller_response_due_at',v_due))
  on conflict do nothing;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'claim_opened',jsonb_build_object('claim_id',v_claim,'reason',p_reason_code,'seller_response_due_at',v_due));
  return v_claim;
end;
$$;
revoke all on function public.open_order_claim(uuid,text,text) from public,anon;
grant execute on function public.open_order_claim(uuid,text,text) to authenticated,service_role;

create or replace function public.seller_respond_to_claim(p_claim_id uuid,p_response text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare c public.claims; o public.orders;
begin
  if char_length(btrim(coalesce(p_response,'')))<20 then raise exception 'Explica tu respuesta con al menos 20 caracteres'; end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null or c.status not in('open','under_review','seller_response') then raise exception 'La reclamación ya no admite respuesta'; end if;
  select * into o from public.orders where id=c.order_id for update;
  if o.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if now()>coalesce(c.seller_response_due_at,c.created_at+interval '3 days') then raise exception 'El plazo para responder terminó'; end if;

  update public.claims
  set seller_response=btrim(p_response),seller_responded_at=now(),status='seller_response'
  where id=c.id;

  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  values(o.buyer_id,o.id,'claim_seller_response','La vendedora respondió a tu reclamación',
    'La respuesta quedó incorporada al expediente. SECOND VOW revisará las versiones y la evidencia disponible antes de decidir.',
    jsonb_build_object('claim_id',c.id))
  on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'claim_seller_response',jsonb_build_object('claim_id',c.id));
end;
$$;
revoke all on function public.seller_respond_to_claim(uuid,text) from public,anon;
grant execute on function public.seller_respond_to_claim(uuid,text) to authenticated,service_role;

-- Cuando la responsabilidad es de la vendedora, la compradora no adelanta el
-- retorno: la vendedora dispone de dos días para proporcionar una guía pagada.
create or replace function public.set_seller_paid_return_deadline()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_liability text;
begin
  if new.status='approved_return' and old.status is distinct from 'approved_return' then
    select liability into v_liability from public.claim_resolutions where claim_id=new.id;
    if v_liability='seller' then
      new.return_label_deadline_at:=now()+interval '2 days';
      new.return_shipping_deadline_at:=null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.set_seller_paid_return_deadline() from public,anon,authenticated;

drop trigger if exists seller_paid_return_deadline on public.claims;
create trigger seller_paid_return_deadline
before update on public.claims
for each row execute function public.set_seller_paid_return_deadline();

create or replace function public.seller_provide_return_label(p_claim_id uuid,p_carrier text,p_tracking_number text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare c public.claims; o public.orders; v_liability text;
begin
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null or c.status<>'approved_return' then raise exception 'La devolución no está disponible'; end if;
  select * into o from public.orders where id=c.order_id for update;
  if o.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  select liability into v_liability from public.claim_resolutions where claim_id=c.id;
  if v_liability<>'seller' then raise exception 'La decisión no asignó la guía de regreso a la vendedora'; end if;
  if c.return_label_deadline_at is null or now()>c.return_label_deadline_at then raise exception 'El plazo para proporcionar la guía terminó'; end if;
  if nullif(btrim(p_carrier),'') is null or nullif(btrim(p_tracking_number),'') is null then raise exception 'Paquetería y número de guía son obligatorios'; end if;
  if not exists(select 1 from public.order_evidence where order_id=o.id and uploaded_by=(select auth.uid()) and evidence_type='seller_return_label') then
    raise exception 'Primero carga la guía prepagada en PDF o imagen';
  end if;

  update public.claims set return_carrier=btrim(p_carrier),return_tracking_number=btrim(p_tracking_number),return_shipping_deadline_at=now()+interval '5 days' where id=c.id;
  insert into public.shipments(order_id,direction,carrier,tracking_number,status)
  values(o.id,'return',btrim(p_carrier),btrim(p_tracking_number),'label_created')
  on conflict(order_id) where direction='return' do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='label_created',updated_at=now();
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  values(o.buyer_id,o.id,'return_label_ready','Tu guía prepagada de devolución está lista','Descárgala desde tu pedido, entrega el paquete a la paquetería y confirma el envío dentro de cinco días naturales.',jsonb_build_object('claim_id',c.id,'carrier',btrim(p_carrier),'tracking_number',btrim(p_tracking_number)))
  on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'return_label_provided',jsonb_build_object('claim_id',c.id,'carrier',btrim(p_carrier),'tracking_number',btrim(p_tracking_number)));
end;
$$;
revoke all on function public.seller_provide_return_label(uuid,text,text) from public,anon;
grant execute on function public.seller_provide_return_label(uuid,text,text) to authenticated,service_role;

create or replace function public.register_return_shipment(p_order_id uuid,p_carrier text,p_tracking_number text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.orders; c public.claims; v_liability text; v_carrier text; v_tracking text;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  select * into c from public.claims where order_id=o.id and status='approved_return' order by created_at desc limit 1 for update;
  if c.id is null then raise exception 'La devolución no está autorizada'; end if;
  if c.return_shipping_deadline_at is null or now()>c.return_shipping_deadline_at then raise exception 'El plazo para enviar la devolución venció'; end if;
  select liability into v_liability from public.claim_resolutions where claim_id=c.id;
  if v_liability='seller' then
    if c.return_carrier is null or c.return_tracking_number is null then raise exception 'La vendedora todavía no proporciona la guía prepagada'; end if;
    v_carrier:=c.return_carrier; v_tracking:=c.return_tracking_number;
  else
    v_carrier:=nullif(btrim(p_carrier),''); v_tracking:=nullif(btrim(p_tracking_number),'');
    if v_carrier is null or v_tracking is null then raise exception 'Paquetería y guía son obligatorias'; end if;
  end if;
  insert into public.shipments(order_id,direction,carrier,tracking_number,status,shipped_at)
  values(o.id,'return',v_carrier,v_tracking,'in_transit',now())
  on conflict(order_id) where direction='return' do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,now()),updated_at=now();
  update public.claims set status='return_shipped',return_shipped_at=now(),return_carrier=v_carrier,return_tracking_number=v_tracking where id=c.id;
  update public.orders set status='return_shipped',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'return_shipped',jsonb_build_object('carrier',v_carrier,'tracking_number',v_tracking));
end;
$$;
revoke all on function public.register_return_shipment(uuid,text,text) from public,anon;
grant execute on function public.register_return_shipment(uuid,text,text) to authenticated,service_role;

-- Ajusta el correo/notificación generado por el resolutor existente para que
-- no indique a la compradora comprar una guía cuando corresponde a la vendedora.
create or replace function public.claim_decision_prepaid_copy()
returns trigger
language plpgsql
set search_path=''
as $$
declare o public.orders; r public.claim_resolutions;
begin
  if new.kind='claim_decision' and new.order_id is not null then
    select * into o from public.orders where id=new.order_id;
    select * into r from public.claim_resolutions where order_id=new.order_id order by decided_at desc limit 1;
    if r.decision='authorize_return' and r.liability='seller' then
      if new.user_id=o.buyer_id then
        new.body:='Se autorizó la devolución. La vendedora debe pagar y compartir una guía prepagada; no compres una guía por tu cuenta. Revisa el pedido para descargarla cuando esté lista.';
      elsif new.user_id=o.seller_id then
        new.body:='Se autorizó la devolución y se atribuyó el incumplimiento a la vendedora. Debes pagar y cargar una guía prepagada desde el pedido dentro del plazo indicado.';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.claim_decision_prepaid_copy() from public,anon,authenticated;
drop trigger if exists claim_decision_prepaid_copy on public.notifications;
create trigger claim_decision_prepaid_copy
before insert on public.notifications
for each row execute function public.claim_decision_prepaid_copy();

-- Impide resolver antes de que la vendedora responda o venza su plazo. También
-- evita aplicar retroactivamente el cargo del 18% a pedidos con términos previos.
create or replace function public.guard_claim_resolution_due_process()
returns trigger
language plpgsql
set search_path=''
as $$
declare c public.claims; o public.orders;
begin
  select * into c from public.claims where id=new.claim_id;
  select * into o from public.orders where id=new.order_id;
  if c.seller_responded_at is null and now()<coalesce(c.seller_response_due_at,c.created_at+interval '3 days') then
    raise exception 'La vendedora todavía puede responder. Espera su respuesta o el vencimiento del plazo.';
  end if;
  if new.seller_charge_selected and coalesce(o.checkout_terms_version,'')<'2026-09-12.1' then
    raise exception 'Este pedido aceptó una versión anterior de los términos; no puede aplicarse retroactivamente el cargo del 18%%.';
  end if;
  if new.status='final' and not (tg_op='UPDATE' and old.status='appealed') then
    raise exception 'Una decisión solo puede marcarse final después de una solicitud de revisión.';
  end if;
  return new;
end;
$$;

drop trigger if exists claim_resolution_due_process on public.claim_resolutions;
create trigger claim_resolution_due_process
before insert or update on public.claim_resolutions
for each row execute function public.guard_claim_resolution_due_process();
revoke all on function public.guard_claim_resolution_due_process() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
