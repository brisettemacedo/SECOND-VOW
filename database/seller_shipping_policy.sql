alter table public.offers add column if not exists seller_terms_version text,
 add column if not exists seller_terms_accepted_at timestamptz,
 add column if not exists seller_legal_bundle_hash text;
alter table public.orders add column if not exists seller_shipping_terms_version text,
 add column if not exists seller_shipping_terms_accepted_at timestamptz;
alter table public.seller_debts alter column claim_id drop not null, alter column resolution_id drop not null;
alter table public.seller_debts add column if not exists debt_type text not null default 'seller_breach';
alter table public.seller_debts add constraint seller_debt_origin_check check(
 (debt_type='seller_breach' and claim_id is not null and resolution_id is not null)
 or (debt_type='shipping_nonperformance' and claim_id is null and resolution_id is null));
create unique index seller_nonshipment_debt_once on public.seller_debts(order_id) where debt_type='shipping_nonperformance';
alter table public.payment_ledger drop constraint payment_ledger_type_check;
alter table public.payment_ledger add constraint payment_ledger_type_check check(entry_type in('buyer_charge','shipping_charge','seller_commission','seller_admin_fee','processor_fee','seller_payout','refund','payout_reversal','adjustment','seller_breach_charge','return_shipping_charge','debt_offset','seller_nonshipment_charge'));

create or replace function public.create_offer_v2(p_dress_id uuid,p_amount_mxn integer,p_shipping_mxn integer,p_terms_version text,p_legal_bundle_hash text,p_terms_accepted boolean,p_conversation_id uuid default null,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_offer uuid;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 if p_terms_accepted is distinct from true or p_terms_version is distinct from '2026-09-30.1' or p_legal_bundle_hash is distinct from '6cc8bb0911fad410649ff35e66bfb128451141e864ffe915a711d52ef7672936' then raise exception 'Lee y acepta los Términos vigentes de la venta'; end if;
 v_offer:=public.create_offer(p_dress_id,p_amount_mxn,p_shipping_mxn,p_conversation_id,p_note);
 update public.offers set seller_terms_version=p_terms_version,seller_terms_accepted_at=now(),seller_legal_bundle_hash=p_legal_bundle_hash where id=v_offer;
 insert into public.legal_acceptances(user_id,document_type,document_version,source)
 values(auth.uid(),'terms',p_terms_version,'seller_offer:'||v_offer::text||':'||p_legal_bundle_hash) on conflict do nothing;
 return v_offer;
end $$;
revoke all on function public.create_offer_v2(uuid,integer,integer,text,text,boolean,uuid,text) from public,anon;
grant execute on function public.create_offer_v2(uuid,integer,integer,text,text,boolean,uuid,text) to authenticated,service_role;
revoke execute on function public.create_offer(uuid,integer,integer,uuid,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mark_order_shipped_v2(p_order_id uuid, p_carrier text, p_tracking_number text, p_id_delivery boolean, p_terms_accepted boolean, p_terms_version text, p_legal_bundle_hash text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or o.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.status not in('paid','preparing_shipment') or o.shipping_blocked_at is not null then raise exception 'El pedido no puede enviarse'; end if;
  if o.seller_ship_by is not null and now()>o.seller_ship_by then raise exception 'El plazo de cinco días naturales venció'; end if;
  if nullif(btrim(coalesce(p_carrier,'')),'') is null or nullif(btrim(coalesce(p_tracking_number,'')),'') is null then raise exception 'Paquetería y guía son obligatorias'; end if;
  if p_id_delivery is distinct from true or p_terms_accepted is distinct from true then raise exception 'Confirma la entrega contra identificación y los Términos de la venta'; end if;
  if p_terms_version is distinct from '2026-09-30.1' or p_legal_bundle_hash is distinct from '6cc8bb0911fad410649ff35e66bfb128451141e864ffe915a711d52ef7672936' then raise exception 'Lee y acepta los Términos vigentes'; end if;
  insert into public.legal_acceptances(user_id,document_type,document_version,source)
  values(auth.uid(),'seller_shipping',p_terms_version,'order_shipping:'||o.id::text||':'||p_legal_bundle_hash) on conflict do nothing;

  insert into public.shipments(order_id,direction,carrier,tracking_number,status,id_delivery_required,shipped_at)
  values(o.id,'outbound',btrim(p_carrier),btrim(p_tracking_number),'in_transit',true,now())
  on conflict(order_id) where direction='outbound' do update set
    carrier=excluded.carrier,
    tracking_number=excluded.tracking_number,
    status='in_transit',
    id_delivery_required=true,
    shipped_at=coalesce(public.shipments.shipped_at,now()),
    updated_at=now();

  update public.orders set
    status='shipped',
    carrier=btrim(p_carrier),
    tracking_number=btrim(p_tracking_number),
    shipped_at=coalesce(shipped_at,now()),
    seller_id_delivery_acknowledged_at=now(),
    seller_shipping_terms_version=p_terms_version,
    seller_shipping_terms_accepted_at=now(),
    updated_at=now()
  where id=o.id;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'shipped',jsonb_build_object('carrier',btrim(p_carrier),'tracking_number',btrim(p_tracking_number),'id_delivery',true,'terms_version',p_terms_version,'terms_hash',p_legal_bundle_hash));

  insert into public.notifications(user_id,order_id,dress_id,kind,title,body)
  values(o.buyer_id,o.id,o.dress_id,'shipment_registered','Tu vestido fue enviado','Guía '||btrim(p_tracking_number)||' con '||btrim(p_carrier)||'. Ya puedes seguir el envío desde tu pedido. La entrega requiere firma e identificación oficial.');
end $function$;

revoke all on function public.mark_order_shipped_v2(uuid,text,text,boolean,boolean,text,text) from public,anon;
grant execute on function public.mark_order_shipped_v2(uuid,text,text,boolean,boolean,text,text) to authenticated,service_role;
revoke execute on function public.mark_order_shipped(uuid,text,text,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.seller_request_order_cancellation(uuid,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.backend_record_refund(p_order_id uuid, p_provider_refund_id text, p_amount_mxn integer, p_status text, p_reason_code text DEFAULT 'other'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.orders; v_payment uuid; c public.claims; r public.claim_resolutions; v_charge integer; v_debt integer; v_admin_debt uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  if p_amount_mxn is null or p_amount_mxn<=0 then raise exception 'Importe de reembolso inválido'; end if;
  if p_status not in('pending','processing','succeeded','failed','cancelled') then raise exception 'Estado inválido'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  select id into v_payment from public.payments where order_id=o.id and status in('paid','partially_refunded','refunded') order by created_at desc limit 1;
  select * into c from public.claims where order_id=o.id order by created_at desc limit 1;
  insert into public.refunds(order_id,claim_id,payment_id,provider,provider_refund_id,amount_mxn,reason_code,status,completed_at)
  values(o.id,c.id,v_payment,'stripe',p_provider_refund_id,p_amount_mxn,p_reason_code,p_status,case when p_status='succeeded' then now() else null end)
  on conflict(provider_refund_id) do update set status=excluded.status,claim_id=coalesce(public.refunds.claim_id,excluded.claim_id),completed_at=case when excluded.status='succeeded' then coalesce(public.refunds.completed_at,now()) else public.refunds.completed_at end;
  if p_status='succeeded' then
    update public.payments set status=case when p_amount_mxn>=amount_mxn then 'refunded' else 'partially_refunded' end,updated_at=now() where id=v_payment;
    update public.orders set status=case when p_amount_mxn>=coalesce(amount_charged_mxn,total_mxn) then 'refunded' else status end,updated_at=now() where id=o.id;
    if p_amount_mxn>=coalesce(o.amount_charged_mxn,o.total_mxn) then
      update public.dresses set status=case when o.shipping_block_reason='shipping_deadline_expired' and o.shipped_at is null then 'approved' else 'archived' end where id=o.dress_id and status in('reserved','sold','archived','approved');
    end if;
    update public.seller_payouts set status=case when status in('held','releasable','requested','paused') then 'reversed' else status end,updated_at=now() where order_id=o.id;
    update public.claims set status='refunded',refund_amount_mxn=p_amount_mxn,resolved_at=coalesce(resolved_at,now()) where order_id=o.id and status in('returned','refund_pending');
    insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id) values(o.id,'refund',-p_amount_mxn,'stripe_refund',p_provider_refund_id) on conflict do nothing;

    if o.shipping_block_reason='shipping_deadline_expired' and o.shipped_at is null
       and p_amount_mxn>=coalesce(o.amount_charged_mxn,o.total_mxn)
       and exists(select 1 from public.offers f where f.id=o.offer_id and f.seller_terms_version='2026-09-30.1' and f.seller_terms_accepted_at is not null) then
      v_charge:=round(p_amount_mxn*0.04);
      if v_charge>0 then
        insert into public.seller_debts(seller_id,order_id,claim_id,resolution_id,breach_charge_mxn,original_amount_mxn,debt_type)
        values(o.seller_id,o.id,null,null,v_charge,v_charge,'shipping_nonperformance')
        on conflict(order_id) where debt_type='shipping_nonperformance' do nothing returning id into v_admin_debt;
        if v_admin_debt is not null then
          insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id,metadata)
          values(o.id,'seller_nonshipment_charge',v_charge,'seller_debt_assessment',v_admin_debt::text,jsonb_build_object('rate_bps',400,'refunded_amount_mxn',p_amount_mxn,'terms_version','2026-09-30.1'));
          insert into public.notifications(user_id,order_id,kind,title,body,metadata)
          values(o.seller_id,o.id,'shipping_admin_fee','Cargo por falta de envío','Se registró el cargo administrativo del 4%, se descontará de tu siguiente venta concluida',jsonb_build_object('debt_mxn',v_charge));
        end if;
      end if;
    end if;

    select * into r from public.claim_resolutions where claim_id=c.id;
    if r.id is not null and r.decision='authorize_return' and r.liability='seller' and r.seller_charge_selected then
      v_charge:=round(p_amount_mxn*r.seller_charge_bps/10000.0);
      v_debt:=v_charge+r.return_shipping_mxn;
      update public.claim_resolutions set seller_charge_amount_mxn=v_charge,status='final',finalized_at=coalesce(finalized_at,now()),updated_at=now() where id=r.id;
      if v_debt>0 then
        insert into public.seller_debts(seller_id,order_id,claim_id,resolution_id,breach_charge_mxn,return_shipping_mxn,original_amount_mxn)
        values(o.seller_id,o.id,c.id,r.id,v_charge,r.return_shipping_mxn,v_debt)
        on conflict(claim_id) do update set breach_charge_mxn=excluded.breach_charge_mxn,return_shipping_mxn=excluded.return_shipping_mxn,original_amount_mxn=excluded.original_amount_mxn,updated_at=now();
        insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id,metadata)
        values(o.id,'seller_breach_charge',v_charge,'claim_resolution',r.id::text,jsonb_build_object('rate_bps',r.seller_charge_bps)) on conflict do nothing;
        if r.return_shipping_mxn>0 then
          insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id)
          values(o.id,'return_shipping_charge',r.return_shipping_mxn,'claim_resolution',r.id::text) on conflict do nothing;
        end if;
        insert into public.notifications(user_id,order_id,kind,title,body,metadata)
        values(o.seller_id,o.id,'seller_debt_created','Cargo por incumplimiento atribuible','La resolución confirmó un incumplimiento atribuible. El cargo documentado se compensará con saldos futuros; no se hará un débito automático a tu tarjeta o banco.',jsonb_build_object('debt_mxn',v_debt,'claim_id',c.id)) on conflict do nothing;
        insert into public.user_incidents(user_id,order_id,claim_id,actor_role,incident_code,severity,notes,created_by)
        values(o.seller_id,o.id,c.id,'seller',r.matrix_code,case when r.matrix_code='seller_misrepresentation' then 2 else 1 end,r.reason,r.decided_by)
        on conflict(user_id,claim_id,incident_code) do update set status='confirmed',notes=excluded.notes,created_by=excluded.created_by,created_at=now(),reversed_at=null;
      end if;
    end if;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_seller_payout(p_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.seller_payouts; a public.seller_payment_accounts; o public.orders; d public.seller_debts;
  v_available integer; v_take integer; v_offset integer:=0;
begin
  select * into p from public.seller_payouts where order_id=p_order_id for update;
  select * into o from public.orders where id=p_order_id for update;
  if p.id is null or p.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if o.status<>'completed' or o.shipping_blocked_at is not null or(o.stripe_dispute_status is not null and o.stripe_dispute_status<>'won') or exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'El saldo está bloqueado por una revisión, reclamación o contracargo'; end if;
  if p.status not in('releasable','failed') then raise exception 'El saldo todavía no está disponible para retiro'; end if;
  select * into a from public.seller_payment_accounts where user_id=(select auth.uid());
  if a.user_id is null or a.onboarding_status<>'complete' or not a.payouts_enabled or not a.bank_account_linked then raise exception 'Primero vincula y verifica tu cuenta bancaria'; end if;

  if p.transfer_amount_mxn is null then
    v_available:=coalesce(p.gross_amount_mxn,p.amount_mxn);
    for d in select * from public.seller_debts where seller_id=p.seller_id and status in('open','partially_recovered') and (debt_type<>'shipping_nonperformance' or created_at<=o.completed_at) order by created_at for update loop
      exit when v_available<=0;
      v_take:=least(v_available,d.original_amount_mxn-d.recovered_amount_mxn);
      if v_take>0 then
        insert into public.seller_debt_allocations(debt_id,payout_id,amount_mxn) values(d.id,p.id,v_take) on conflict(debt_id,payout_id) do nothing;
        update public.seller_debts set recovered_amount_mxn=recovered_amount_mxn+v_take,
          status=case when recovered_amount_mxn+v_take>=original_amount_mxn then 'settled' else 'partially_recovered' end,
          settled_at=case when recovered_amount_mxn+v_take>=original_amount_mxn then now() else null end,updated_at=now() where id=d.id;
        insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id,metadata)
        values(o.id,'debt_offset',-v_take,'seller_debt_allocation',d.id::text,jsonb_build_object('payout_id',p.id)) on conflict do nothing;
        v_available:=v_available-v_take; v_offset:=v_offset+v_take;
      end if;
    end loop;
    update public.seller_payouts set gross_amount_mxn=coalesce(gross_amount_mxn,amount_mxn),debt_offset_mxn=v_offset,transfer_amount_mxn=v_available where id=p.id returning * into p;
  end if;

  update public.seller_payouts set status='requested',requested_at=coalesce(requested_at,now()),connected_account_id=a.provider_account_id,failure_code=null,updated_at=now() where id=p.id returning * into p;
  return p.id;
end;
$function$;


create or replace function public.apply_debts_when_balance_available()
returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders; d public.seller_debts; v_remaining integer; v_take integer; v_total integer:=0; v_allocation uuid;
begin
 if new.status<>'releasable' or new.transfer_amount_mxn is not null then return new; end if;
 select * into o from public.orders where id=new.order_id;
 if o.status<>'completed' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.seller_id::text,400));
 v_remaining:=coalesce(new.gross_amount_mxn,new.amount_mxn);
 for d in select * from public.seller_debts where seller_id=new.seller_id and status in('open','partially_recovered')
  and (debt_type<>'shipping_nonperformance' or created_at<=o.completed_at) order by created_at,id for update loop
  exit when v_remaining<=0;
  v_take:=least(v_remaining,d.original_amount_mxn-d.recovered_amount_mxn);
  if v_take>0 then
   insert into public.seller_debt_allocations(debt_id,payout_id,amount_mxn) values(d.id,new.id,v_take)
    on conflict(debt_id,payout_id) do nothing returning id into v_allocation;
   if v_allocation is not null then
    update public.seller_debts set recovered_amount_mxn=recovered_amount_mxn+v_take,
     status=case when recovered_amount_mxn+v_take>=original_amount_mxn then 'settled' else 'partially_recovered' end,
     settled_at=case when recovered_amount_mxn+v_take>=original_amount_mxn then now() else null end,updated_at=now() where id=d.id;
    insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id,metadata)
     values(new.order_id,'debt_offset',-v_take,'seller_debt_allocation',v_allocation::text,jsonb_build_object('payout_id',new.id,'debt_type',d.debt_type,'origin_order_id',d.order_id));
    v_total:=v_total+v_take; v_remaining:=v_remaining-v_take;
   end if;
  end if;
 end loop;
 new.gross_amount_mxn:=coalesce(new.gross_amount_mxn,new.amount_mxn);
 new.debt_offset_mxn:=v_total;
 new.transfer_amount_mxn:=v_remaining;
 return new;
end $$;
revoke all on function public.apply_debts_when_balance_available() from public,anon,authenticated;
create trigger apply_seller_debts_before_release before update of status on public.seller_payouts for each row execute function public.apply_debts_when_balance_available();

create or replace function public.restore_nonshipment_offsets_on_reversal()
returns trigger language plpgsql security definer set search_path='' as $$
declare a record;
begin
 if new.status<>'reversed' or old.status='reversed' then return new; end if;
 for a in select x.id,x.debt_id,x.amount_mxn from public.seller_debt_allocations x join public.seller_debts d on d.id=x.debt_id
  where x.payout_id=new.id and x.status='applied' and d.debt_type='shipping_nonperformance' for update of x,d loop
  update public.seller_debt_allocations set status='reversed',reversed_at=now() where id=a.id;
  update public.seller_debts set recovered_amount_mxn=greatest(0,recovered_amount_mxn-a.amount_mxn),
   status=case when recovered_amount_mxn-a.amount_mxn<=0 then 'open' else 'partially_recovered' end,settled_at=null,updated_at=now() where id=a.debt_id;
 end loop;
 return new;
end $$;
revoke all on function public.restore_nonshipment_offsets_on_reversal() from public,anon,authenticated;
create trigger restore_nonshipment_offsets after update of status on public.seller_payouts for each row execute function public.restore_nonshipment_offsets_on_reversal();
