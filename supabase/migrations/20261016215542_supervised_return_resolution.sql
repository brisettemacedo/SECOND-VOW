-- Flujo autorizado por la propietaria el 16 de octubre de 2026.
-- No ejecuta reembolsos ni modifica importes de pedidos existentes.
begin;
alter table public.claims
  add column if not exists return_shipping_payment_mode text not null default 'prepaid' check (return_shipping_payment_mode in ('prepaid','collect')),
  add column if not exists return_instructions text,
  add column if not exists return_reviewed_at timestamptz,
  add column if not exists return_reviewed_by uuid references public.profiles(id),
  add column if not exists return_review_reason text;

create or replace function public.admin_set_return_instructions(p_claim_id uuid,p_instructions text,p_payment_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.claims; o public.orders; r public.claim_resolutions;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_instructions,'')))<20 or char_length(p_instructions)>2000 then raise exception 'Indica destino completo e instrucciones, entre 20 y 2000 caracteres'; end if;
  if p_payment_mode is null or p_payment_mode not in ('prepaid','collect') then raise exception 'Modalidad inválida'; end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null or c.status<>'approved_return' then raise exception 'La devolución no está autorizada o ya fue enviada'; end if;
  select * into o from public.orders where id=c.order_id for update;
  select * into r from public.claim_resolutions where claim_id=c.id;
  if r.id is null or r.decision<>'authorize_return' or r.status='appealed' then raise exception 'La resolución está pendiente de revisión'; end if;
  if p_payment_mode='collect' and (coalesce(o.checkout_terms_version,'')<'2026-10-16.1' or r.liability<>'seller') then raise exception 'El flete por cobrar solo corresponde a nuevas operaciones con responsabilidad de la vendedora'; end if;
  update public.claims set return_instructions=btrim(p_instructions),return_shipping_payment_mode=p_payment_mode,
    return_shipping_deadline_at=case when p_payment_mode='collect' then now()+interval '5 days' when r.liability<>'seller' then now()+interval '5 days' else return_shipping_deadline_at end,
    return_label_deadline_at=case when p_payment_mode='prepaid' and r.liability='seller' then now()+interval '2 days' else return_label_deadline_at end where id=c.id;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  select x.user_id,o.id,'return_instructions_ready','Instrucciones de devolución disponibles',
    case when p_payment_mode='collect' then 'La compradora debe devolver el vestido al destino indicado y registrar la guía y el comprobante de admisión, la vendedora paga el flete al recibir y debe aceptar el retorno autorizado, el dinero sigue retenido hasta resolver el expediente.' else 'Consulta el destino autorizado, si el costo corresponde a la vendedora espera su guía prepagada, el dinero sigue retenido hasta resolver el expediente.' end,
    jsonb_build_object('claim_id',c.id,'payment_mode',p_payment_mode)
  from (values(o.buyer_id),(o.seller_id)) x(user_id);
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'return_instructions_ready',jsonb_build_object('claim_id',c.id,'payment_mode',p_payment_mode));
end $$;
revoke all on function public.admin_set_return_instructions(uuid,text,text) from public,anon;
grant execute on function public.admin_set_return_instructions(uuid,text,text) to authenticated;

create or replace function public.admin_review_return(p_claim_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.claims; o public.orders; r public.claim_resolutions; s public.shipments;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<20 or char_length(p_reason)>2000 then raise exception 'Documenta la validación del retorno y la solución, entre 20 y 2000 caracteres'; end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null or c.status not in ('return_shipped','returned','refund_pending') then raise exception 'Falta registrar el envío de devolución'; end if;
  select * into o from public.orders where id=c.order_id for update;
  if o.status not in ('return_shipped','returned','refund_pending') or (o.stripe_dispute_status is not null and o.stripe_dispute_status<>'won') then raise exception 'El pedido tiene un bloqueo o contracargo que requiere conciliación'; end if;
  select * into r from public.claim_resolutions where claim_id=c.id for update;
  if r.id is null or r.decision<>'authorize_return' or r.status='appealed' or (r.status<>'final' and (r.appeal_deadline_at is null or r.appeal_deadline_at>now())) then raise exception 'La resolución aún está en revisión'; end if;
  select * into s from public.shipments where order_id=o.id and direction='return' for update;
  if s.id is null or nullif(btrim(c.return_tracking_number),'') is null or s.tracking_number is distinct from c.return_tracking_number then raise exception 'Falta una guía de retorno consistente'; end if;
  if s.status<>'delivered' and not exists(select 1 from public.order_evidence e where e.order_id=o.id and e.uploaded_by=o.buyer_id and e.evidence_type='buyer_return_packed' and e.created_at>=c.created_at) then raise exception 'Falta el comprobante de entrega a paquetería o una entrega acreditada por seguimiento'; end if;
  if c.return_reviewed_at is not null then return; end if;
  update public.claims set return_reviewed_at=now(),return_reviewed_by=(select auth.uid()),return_review_reason=btrim(p_reason),status='refund_pending' where id=c.id;
  update public.orders set status='returned',updated_at=now() where id=o.id;
  update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in ('held','releasable','requested');
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'return_reviewed',jsonb_build_object('claim_id',c.id,'reason',btrim(p_reason),'tracking_number',c.return_tracking_number));
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  select x.user_id,o.id,'return_reviewed','Retorno verificado por SECOND VOW','SECOND VOW verificó el retorno y documentó la solución, el reembolso requiere una acción administrativa separada, el saldo de la venta sigue retenido.',jsonb_build_object('claim_id',c.id)
  from (values(o.buyer_id),(o.seller_id)) x(user_id);
end $$;
revoke all on function public.admin_review_return(uuid,text) from public,anon;
grant execute on function public.admin_review_return(uuid,text) to authenticated;

CREATE OR REPLACE FUNCTION public.register_return_shipment(p_order_id uuid, p_carrier text, p_tracking_number text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.orders; c public.claims; v_liability text; v_carrier text; v_tracking text;
begin
  if (select auth.uid()) is null then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_carrier,''))) not between 1 and 80 or char_length(btrim(coalesce(p_tracking_number,''))) not between 1 and 120 then raise exception 'Paquetería y guía son obligatorias'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.buyer_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  select * into c from public.claims where order_id=o.id and status='approved_return' order by created_at desc limit 1 for update;
  if c.id is null then raise exception 'La devolución no está autorizada'; end if;
  if c.return_shipping_deadline_at is null or now()>c.return_shipping_deadline_at then raise exception 'El plazo para enviar la devolución venció'; end if;
  select liability into v_liability from public.claim_resolutions where claim_id=c.id;
  if exists(select 1 from public.claim_resolutions where claim_id=c.id and status='appealed') then raise exception 'La resolución está en revisión'; end if;
  if c.return_shipping_payment_mode='collect' then
    if nullif(btrim(c.return_instructions),'') is null then raise exception 'Faltan instrucciones administrativas de retorno'; end if;
    if not exists(select 1 from public.order_evidence e where e.order_id=o.id and e.uploaded_by=(select auth.uid()) and e.evidence_type='buyer_return_packed' and e.created_at>=c.created_at) then raise exception 'Adjunta el comprobante de admisión de la paquetería antes de registrar la guía'; end if;
    v_carrier:=btrim(p_carrier); v_tracking:=btrim(p_tracking_number);
  elsif v_liability='seller' then
    if c.return_carrier is null or c.return_tracking_number is null then raise exception 'La vendedora todavía no proporciona la guía prepagada'; end if;
    v_carrier:=c.return_carrier; v_tracking:=c.return_tracking_number;
  else
    v_carrier:=nullif(btrim(p_carrier),''); v_tracking:=nullif(btrim(p_tracking_number),'');
    if v_carrier is null or v_tracking is null then raise exception 'Paquetería y guía son obligatorias'; end if;
  end if;
  if exists(select 1 from public.shipments where lower(btrim(tracking_number))=lower(v_tracking) and (order_id<>o.id or direction<>'return')) then raise exception 'La guía ya está asociada a otro envío'; end if;
  insert into public.shipments(order_id,direction,carrier,tracking_number,status,shipped_at)
  values(o.id,'return',v_carrier,v_tracking,'in_transit',now())
  on conflict(order_id) where direction='return' do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,now()),updated_at=now();
  update public.claims set status='return_shipped',return_shipped_at=now(),return_carrier=v_carrier,return_tracking_number=v_tracking where id=c.id;
  update public.orders set status='return_shipped',updated_at=now() where id=o.id;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'return_shipped',jsonb_build_object('carrier',v_carrier,'tracking_number',v_tracking));
end;
$function$;


revoke all on function public.register_return_shipment(uuid,text,text) from public,anon;
grant execute on function public.register_return_shipment(uuid,text,text) to authenticated;

create or replace function public.set_seller_paid_return_deadline()
returns trigger language plpgsql set search_path='' as $$
declare v_liability text; v_terms text;
begin
  if new.status='approved_return' and old.status is distinct from 'approved_return' then
    select liability into v_liability from public.claim_resolutions where claim_id=new.id;
    select checkout_terms_version into v_terms from public.orders where id=new.order_id;
    new.return_reviewed_at:=null; new.return_reviewed_by:=null; new.return_review_reason:=null;
    if v_liability='seller' then
      new.return_label_deadline_at:=now()+interval '2 days'; new.return_shipping_deadline_at:=null;
    end if;
    if coalesce(v_terms,'')>='2026-10-16.1' then
      new.return_instructions:=null; new.return_shipping_payment_mode:='prepaid'; new.return_shipping_deadline_at:=null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.set_seller_paid_return_deadline() from public,anon,authenticated;

-- Keep existing copy trigger, but route new orders to administrative instructions.
create or replace function public.claim_decision_prepaid_copy()
returns trigger language plpgsql set search_path='' as $$
declare o public.orders; r public.claim_resolutions;
begin
  if new.kind='claim_decision' and new.order_id is not null then
    select * into o from public.orders where id=new.order_id;
    select * into r from public.claim_resolutions where order_id=new.order_id order by decided_at desc limit 1;
    if r.decision='authorize_return' and r.liability='seller' then
      if coalesce(o.checkout_terms_version,'')>='2026-10-16.1' then
        new.body:='Se autorizó una devolución excepcional, espera las instrucciones de SECOND VOW, la compradora debe registrar la guía y acreditar la entrega a paquetería, la vendedora debe recibir el retorno autorizado, el dinero permanece retenido hasta resolver el expediente.';
      elsif new.user_id=o.buyer_id then
        new.body:='Se autorizó la devolución, la vendedora debe compartir la guía prepagada, no adelantes ese gasto, el dinero permanece retenido hasta resolver el expediente.';
      else
        new.body:='Se autorizó la devolución atribuible a la vendedora, debes compartir la guía prepagada y recibir el retorno autorizado, el dinero permanece retenido hasta resolver el expediente.';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.claim_decision_prepaid_copy() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_resolve_claim_v2(p_claim_id uuid, p_action text, p_liability text, p_matrix_code text, p_reason text, p_apply_seller_charge boolean DEFAULT false, p_return_shipping_mxn integer DEFAULT 0, p_processor_cost_mxn integer DEFAULT 0, p_final boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.claims; o public.orders; r public.claim_resolutions; v_charge integer:=0; v_total integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_action='authorize_return' and p_matrix_code in ('buyer_fit_or_remorse','buyer_address_or_misuse','insufficient_evidence','mutual_cancellation') then raise exception 'Este supuesto no autoriza una devolución excepcional'; end if;
  if p_action not in ('authorize_return','reject') then raise exception 'Decisión inválida'; end if;
  if p_liability not in ('seller','buyer','carrier','platform','shared','none') then raise exception 'Responsabilidad inválida'; end if;
  if nullif(btrim(coalesce(p_matrix_code,'')),'') is null then raise exception 'Selecciona un supuesto de resolución'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Registra un motivo de al menos 10 caracteres'; end if;
  if coalesce(p_return_shipping_mxn,0)<0 or coalesce(p_processor_cost_mxn,0)<0 then raise exception 'Los costos no pueden ser negativos'; end if;
  if p_apply_seller_charge and (p_action<>'authorize_return' or p_liability<>'seller') then raise exception 'El cargo solo aplica a un incumplimiento atribuible a la vendedora'; end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null or c.status not in ('open','under_review','seller_response','rejected','approved_return') then raise exception 'Reclamación no disponible'; end if;
  select * into o from public.orders where id=c.order_id for update;
  v_total:=coalesce(o.amount_charged_mxn,o.total_mxn);
  if p_apply_seller_charge then v_charge:=round(v_total*1800.0/10000.0); end if;
  insert into public.claim_resolutions(claim_id,order_id,decision,liability,matrix_code,reason,status,seller_charge_selected,seller_charge_bps,seller_charge_amount_mxn,return_shipping_mxn,processor_cost_mxn,appeal_deadline_at,decided_by,decided_at,finalized_at,updated_at)
  values(c.id,o.id,p_action,p_liability,btrim(p_matrix_code),btrim(p_reason),case when p_final then 'final' else 'provisional' end,p_apply_seller_charge,1800,v_charge,coalesce(p_return_shipping_mxn,0),coalesce(p_processor_cost_mxn,0),now()+interval '3 days',(select auth.uid()),now(),case when p_final then now() else null end,now())
  on conflict(claim_id) do update set decision=excluded.decision,liability=excluded.liability,matrix_code=excluded.matrix_code,reason=excluded.reason,status=excluded.status,seller_charge_selected=excluded.seller_charge_selected,seller_charge_bps=excluded.seller_charge_bps,seller_charge_amount_mxn=excluded.seller_charge_amount_mxn,return_shipping_mxn=excluded.return_shipping_mxn,processor_cost_mxn=excluded.processor_cost_mxn,appeal_deadline_at=excluded.appeal_deadline_at,appealed_at=null,appeal_reason=null,decided_by=excluded.decided_by,decided_at=now(),finalized_at=excluded.finalized_at,updated_at=now()
  returning * into r;
  if p_action='authorize_return' then
    update public.claims set status='approved_return',decision='return_authorized',admin_notes=btrim(p_reason),return_authorized_at=coalesce(return_authorized_at,now()),return_shipping_deadline_at=now()+interval '5 days',resolved_at=null where id=c.id;
    update public.orders set status='return_authorized',updated_at=now() where id=o.id;
  else
    update public.claims set status='rejected',decision='rejected',admin_notes=btrim(p_reason),resolved_at=now() where id=c.id;
    if r.status='provisional' then
      update public.orders set status='claim_open',updated_at=now() where id=o.id;
      update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in ('held','releasable','requested');
    else
    update public.orders set status=case when platform_delivery_recorded_at is not null and coalesce(dispute_deadline_at,now())>now() then 'inspection' else 'completed' end,updated_at=now() where id=o.id;
    update public.seller_payouts set status=case when status='paused' and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') and coalesce(o.dispute_deadline_at,now())<=now() then 'releasable' when status='paused' and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') then 'held' else status end,releasable_at=case when status='paused' and coalesce(o.dispute_deadline_at,now())<=now() then coalesce(releasable_at,now()) else releasable_at end,updated_at=now() where order_id=o.id;
    end if;
    if p_liability='buyer' and p_matrix_code='buyer_address_or_misuse' then insert into public.user_incidents(user_id,order_id,claim_id,actor_role,incident_code,severity,notes,created_by) values(o.buyer_id,o.id,c.id,'buyer',p_matrix_code,1,btrim(p_reason),(select auth.uid())) on conflict(user_id,claim_id,incident_code) do update set status='confirmed',notes=excluded.notes,created_by=excluded.created_by,created_at=now(),reversed_at=null; end if;
  end if;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata) values(o.buyer_id,o.id,'claim_decision','Decisión sobre tu reclamación',case when p_action='authorize_return' then 'Se autorizó la devolución. Revisa el pedido para conocer el plazo y registrar la guía.' else 'La reclamación fue rechazada mediante una decisión motivada. Puedes solicitar revisión dentro de tres días.' end,jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'appeal_deadline_at',r.appeal_deadline_at)) on conflict do nothing;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata) values(o.seller_id,o.id,'claim_decision','Decisión sobre la reclamación',case when p_action='authorize_return' then 'Se autorizó la devolución. El saldo continúa retenido. Revisa la decisión y el plazo de revisión.' else 'La reclamación fue rechazada. El expediente conserva la decisión y su motivo.' end,jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'appeal_deadline_at',r.appeal_deadline_at,'seller_charge_selected',p_apply_seller_charge)) on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'claim_decided',jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'decision',p_action,'liability',p_liability,'matrix_code',p_matrix_code,'seller_charge_selected',p_apply_seller_charge,'seller_charge_estimate_mxn',v_charge,'final',p_final));
  return jsonb_build_object('resolution_id',r.id,'seller_charge_estimate_mxn',v_charge,'appeal_deadline_at',r.appeal_deadline_at,'status',r.status);
end;
$function$;



create or replace function public.backend_finalize_claim_reviews()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  with finished as (
    update public.orders o set status='inspection',updated_at=now()
    where o.status='claim_open' and exists (
      select 1 from public.claims c join public.claim_resolutions r on r.claim_id=c.id
      where c.order_id=o.id and c.status='rejected' and r.decision='reject'
        and (r.status='final' or (r.status='provisional' and r.appeal_deadline_at<=now()))
    ) and not exists(select 1 from public.claims c where c.order_id=o.id and c.status not in ('rejected','closed','refunded'))
    and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') and o.shipping_blocked_at is null
    returning o.id
  ), held as (
    update public.seller_payouts p set status='held',updated_at=now() where p.status='paused' and exists(select 1 from finished f where f.id=p.order_id) returning p.id
  ) select count(*) into v_count from finished;
  return v_count;
end $$;
revoke all on function public.backend_finalize_claim_reviews() from public,anon,authenticated;
grant execute on function public.backend_finalize_claim_reviews() to service_role;
create or replace function public.notify_order_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text; v_title text; v_body text; v_event text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status='refund_pending' and new.shipping_block_reason='shipping_deadline_expired' then
    v_kind:='order_shipping_cancelled'; v_title:='Venta cancelada por falta de envío';
    v_body:='Venció el plazo de cinco días naturales sin guía registrada, no envíes el vestido, se tramita el reembolso completo al medio de pago original.';
    v_event:='shipping_deadline_expired';
  elsif new.status='completed' then
    v_kind:='order_completed'; v_title:='Venta concretada';
    v_body:='Terminó la revisión sin reclamación pendiente, consulta la disponibilidad del saldo en el pedido.'; v_event:='order_completed';
  elsif new.status='return_shipped' then
    v_kind:='order_return_shipped'; v_title:='Devolución en tránsito';
    v_body:='La compradora registró una guía de devolución, SECOND VOW verificará la admisión y resolverá el expediente, el registro no libera el dinero.';
  elsif new.status='returned' then
    v_kind:='order_return_received'; v_title:='Devolución recibida';
    v_body:='El retorno sigue en revisión administrativa, el dinero permanece retenido hasta documentar la solución y autorizar el reembolso.';
  elsif new.status='refunded' then
    v_kind:='refund_confirmed'; v_title:='Reembolso confirmado';
    v_body:='Se confirmó el reembolso al medio de pago original, consulta el importe en el pedido, la vendedora no recibe saldo de esta venta.';
  else return new;
  end if;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  select x.user_id,new.id,case when new.status='refunded' and new.shipping_block_reason='shipping_deadline_expired' and x.user_id=new.seller_id then 'order_cancelled_no_shipping' else v_kind end,v_title,v_body,jsonb_build_object('href_path','/pedidos/'||new.id::text)
  from (values(new.buyer_id),(new.seller_id)) x(user_id)
  where not exists(select 1 from public.notifications n where n.user_id=x.user_id and n.order_id=new.id and n.kind=case when new.status='refunded' and new.shipping_block_reason='shipping_deadline_expired' and x.user_id=new.seller_id then 'order_cancelled_no_shipping' else v_kind end)
  on conflict do nothing;
  if v_event is not null and not exists(select 1 from public.order_events e where e.order_id=new.id and e.event_type=v_event) then
    insert into public.order_events(order_id,event_type,metadata) values(new.id,v_event,jsonb_build_object('status',new.status));
  end if;
  return new;
end $$;
revoke all on function public.notify_order_lifecycle() from public,anon,authenticated;
drop trigger if exists notify_order_lifecycle on public.orders;
create trigger notify_order_lifecycle after update of status on public.orders for each row execute function public.notify_order_lifecycle();


notify pgrst,'reload schema';
commit;
