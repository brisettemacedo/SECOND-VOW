-- SECOND VOW 0041 — libera el saldo si una reclamación rechazada ya agotó la ventana
begin;

create or replace function public.admin_resolve_claim_v2(
  p_claim_id uuid,
  p_action text,
  p_liability text,
  p_matrix_code text,
  p_reason text,
  p_apply_seller_charge boolean default false,
  p_return_shipping_mxn integer default 0,
  p_processor_cost_mxn integer default 0,
  p_final boolean default false
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  c public.claims; o public.orders; r public.claim_resolutions; v_charge integer:=0; v_total integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
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
    update public.orders set status=case when platform_delivery_recorded_at is not null and coalesce(dispute_deadline_at,now())>now() then 'inspection' else 'completed' end,updated_at=now() where id=o.id;
    update public.seller_payouts set status=case when status='paused' and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') and coalesce(o.dispute_deadline_at,now())<=now() then 'releasable' when status='paused' and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') then 'held' else status end,releasable_at=case when status='paused' and coalesce(o.dispute_deadline_at,now())<=now() then coalesce(releasable_at,now()) else releasable_at end,updated_at=now() where order_id=o.id;
    if p_liability='buyer' and p_matrix_code='buyer_address_or_misuse' then insert into public.user_incidents(user_id,order_id,claim_id,actor_role,incident_code,severity,notes,created_by) values(o.buyer_id,o.id,c.id,'buyer',p_matrix_code,1,btrim(p_reason),(select auth.uid())) on conflict(user_id,claim_id,incident_code) do update set status='confirmed',notes=excluded.notes,created_by=excluded.created_by,created_at=now(),reversed_at=null; end if;
  end if;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata) values(o.buyer_id,o.id,'claim_decision','Decisión sobre tu reclamación',case when p_action='authorize_return' then 'Se autorizó la devolución. Revisa el pedido para conocer el plazo y registrar la guía.' else 'La reclamación fue rechazada mediante una decisión motivada. Puedes solicitar revisión dentro de tres días.' end,jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'appeal_deadline_at',r.appeal_deadline_at)) on conflict do nothing;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata) values(o.seller_id,o.id,'claim_decision','Decisión sobre la reclamación',case when p_action='authorize_return' then 'Se autorizó la devolución. El saldo continúa retenido. Revisa la decisión y el plazo de revisión.' else 'La reclamación fue rechazada. El expediente conserva la decisión y su motivo.' end,jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'appeal_deadline_at',r.appeal_deadline_at,'seller_charge_selected',p_apply_seller_charge)) on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'claim_decided',jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'decision',p_action,'liability',p_liability,'matrix_code',p_matrix_code,'seller_charge_selected',p_apply_seller_charge,'seller_charge_estimate_mxn',v_charge,'final',p_final));
  return jsonb_build_object('resolution_id',r.id,'seller_charge_estimate_mxn',v_charge,'appeal_deadline_at',r.appeal_deadline_at,'status',r.status);
end;
$$;
revoke all on function public.admin_resolve_claim_v2(uuid,text,text,text,text,boolean,integer,integer,boolean) from public,anon;
grant execute on function public.admin_resolve_claim_v2(uuid,text,text,text,text,boolean,integer,integer,boolean) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
