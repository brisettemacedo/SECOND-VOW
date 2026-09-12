-- SECOND VOW 0039 — resoluciones motivadas, cargos atribuibles e idempotencia financiera
begin;

create table if not exists public.claim_resolutions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  decision text not null check (decision in ('authorize_return','reject')),
  liability text not null check (liability in ('seller','buyer','carrier','platform','shared','none')),
  matrix_code text not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  status text not null default 'provisional' check (status in ('provisional','appealed','final')),
  seller_charge_selected boolean not null default false,
  seller_charge_bps integer not null default 1800 check (seller_charge_bps between 0 and 10000),
  seller_charge_amount_mxn integer not null default 0 check (seller_charge_amount_mxn >= 0),
  return_shipping_mxn integer not null default 0 check (return_shipping_mxn >= 0),
  processor_cost_mxn integer not null default 0 check (processor_cost_mxn >= 0),
  appeal_deadline_at timestamptz not null,
  appealed_at timestamptz,
  appeal_reason text,
  decided_by uuid not null references public.profiles(id),
  decided_at timestamptz not null default now(),
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint claim_resolution_charge_scope check (
    not seller_charge_selected or (decision='authorize_return' and liability='seller')
  )
);
create index if not exists idx_claim_resolutions_order on public.claim_resolutions(order_id);
create index if not exists idx_claim_resolutions_review on public.claim_resolutions(status,appeal_deadline_at);

create table if not exists public.seller_debts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  order_id uuid not null references public.orders(id) on delete restrict,
  claim_id uuid not null unique references public.claims(id) on delete restrict,
  resolution_id uuid not null references public.claim_resolutions(id) on delete restrict,
  breach_charge_mxn integer not null default 0 check (breach_charge_mxn >= 0),
  return_shipping_mxn integer not null default 0 check (return_shipping_mxn >= 0),
  original_amount_mxn integer not null check (original_amount_mxn > 0),
  recovered_amount_mxn integer not null default 0 check (recovered_amount_mxn >= 0),
  status text not null default 'open' check (status in ('open','partially_recovered','settled','waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  waived_at timestamptz,
  waived_by uuid references public.profiles(id),
  waiver_reason text,
  constraint seller_debt_recovery_limit check (recovered_amount_mxn <= original_amount_mxn)
);
create index if not exists idx_seller_debts_open on public.seller_debts(seller_id,status,created_at);

create table if not exists public.seller_debt_allocations (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.seller_debts(id) on delete restrict,
  payout_id uuid not null references public.seller_payouts(id) on delete restrict,
  amount_mxn integer not null check (amount_mxn > 0),
  status text not null default 'applied' check (status in ('applied','reversed')),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  unique(debt_id,payout_id)
);
create index if not exists idx_seller_debt_allocations_payout on public.seller_debt_allocations(payout_id);

create table if not exists public.user_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  claim_id uuid references public.claims(id) on delete set null,
  actor_role text not null check (actor_role in ('buyer','seller')),
  incident_code text not null,
  severity integer not null default 1 check (severity between 1 and 3),
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  notes text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  unique(user_id,claim_id,incident_code)
);
create index if not exists idx_user_incidents_user on public.user_incidents(user_id,status,created_at desc);

alter table public.seller_payouts add column if not exists gross_amount_mxn integer;
alter table public.seller_payouts add column if not exists debt_offset_mxn integer not null default 0;
alter table public.seller_payouts add column if not exists transfer_amount_mxn integer;
update public.seller_payouts set gross_amount_mxn=coalesce(gross_amount_mxn,amount_mxn),
  transfer_amount_mxn=case when status in('held','releasable','failed') then null else coalesce(transfer_amount_mxn,amount_mxn-debt_offset_mxn) end;
alter table public.seller_payouts add constraint seller_payout_debt_amounts_check check (
  (gross_amount_mxn is null or gross_amount_mxn>=0) and debt_offset_mxn>=0
  and (gross_amount_mxn is null or debt_offset_mxn<=gross_amount_mxn)
  and (transfer_amount_mxn is null or transfer_amount_mxn>=0)
  and (gross_amount_mxn is null or transfer_amount_mxn is null or transfer_amount_mxn+debt_offset_mxn=gross_amount_mxn)
);

alter table public.payment_ledger drop constraint if exists payment_ledger_type_check;
alter table public.payment_ledger add constraint payment_ledger_type_check check(entry_type in(
  'buyer_charge','shipping_charge','seller_commission','seller_admin_fee','processor_fee',
  'seller_payout','refund','payout_reversal','adjustment','seller_breach_charge',
  'return_shipping_charge','debt_offset'
));
create unique index if not exists payment_ledger_reference_unique
  on public.payment_ledger(order_id,entry_type,reference_type,reference_id)
  where reference_id is not null;
create unique index if not exists refunds_one_per_claim
  on public.refunds(claim_id) where claim_id is not null;

alter table public.claim_resolutions enable row level security;
alter table public.seller_debts enable row level security;
alter table public.seller_debt_allocations enable row level security;
alter table public.user_incidents enable row level security;

revoke all on public.claim_resolutions,public.seller_debts,public.seller_debt_allocations,public.user_incidents from anon,authenticated;
grant select on public.claim_resolutions,public.seller_debts,public.seller_debt_allocations,public.user_incidents to authenticated;

create policy "claim parties read resolutions" on public.claim_resolutions for select to authenticated
using (exists(select 1 from public.orders o where o.id=order_id and ((select auth.uid()) in (o.buyer_id,o.seller_id) or (select public.is_admin()))));
create policy "seller reads own debts" on public.seller_debts for select to authenticated
using (seller_id=(select auth.uid()) or (select public.is_admin()));
create policy "seller reads own allocations" on public.seller_debt_allocations for select to authenticated
using (exists(select 1 from public.seller_debts d where d.id=debt_id and (d.seller_id=(select auth.uid()) or (select public.is_admin()))));
create policy "users read own incidents" on public.user_incidents for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_admin()));

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
  c public.claims;
  o public.orders;
  r public.claim_resolutions;
  v_charge integer:=0;
  v_total integer;
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

  insert into public.claim_resolutions(
    claim_id,order_id,decision,liability,matrix_code,reason,status,seller_charge_selected,
    seller_charge_bps,seller_charge_amount_mxn,return_shipping_mxn,processor_cost_mxn,
    appeal_deadline_at,decided_by,decided_at,finalized_at,updated_at
  ) values(
    c.id,o.id,p_action,p_liability,btrim(p_matrix_code),btrim(p_reason),case when p_final then 'final' else 'provisional' end,
    p_apply_seller_charge,1800,v_charge,coalesce(p_return_shipping_mxn,0),coalesce(p_processor_cost_mxn,0),
    now()+interval '3 days',(select auth.uid()),now(),case when p_final then now() else null end,now()
  ) on conflict(claim_id) do update set
    decision=excluded.decision,liability=excluded.liability,matrix_code=excluded.matrix_code,reason=excluded.reason,
    status=excluded.status,seller_charge_selected=excluded.seller_charge_selected,seller_charge_bps=excluded.seller_charge_bps,
    seller_charge_amount_mxn=excluded.seller_charge_amount_mxn,return_shipping_mxn=excluded.return_shipping_mxn,
    processor_cost_mxn=excluded.processor_cost_mxn,appeal_deadline_at=excluded.appeal_deadline_at,
    appealed_at=null,appeal_reason=null,decided_by=excluded.decided_by,decided_at=now(),finalized_at=excluded.finalized_at,updated_at=now()
  returning * into r;

  if p_action='authorize_return' then
    update public.claims set status='approved_return',decision='return_authorized',admin_notes=btrim(p_reason),
      return_authorized_at=coalesce(return_authorized_at,now()),return_shipping_deadline_at=now()+interval '5 days',resolved_at=null where id=c.id;
    update public.orders set status='return_authorized',updated_at=now() where id=o.id;
  else
    update public.claims set status='rejected',decision='rejected',admin_notes=btrim(p_reason),resolved_at=now() where id=c.id;
    update public.orders set status=case when platform_delivery_recorded_at is not null and coalesce(dispute_deadline_at,now())>now() then 'inspection' else 'completed' end,updated_at=now() where id=o.id;
    update public.seller_payouts set status=case
      when status='paused' and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') and coalesce(o.dispute_deadline_at,now())<=now() then 'releasable'
      when status='paused' and (o.stripe_dispute_status is null or o.stripe_dispute_status='won') then 'held'
      else status end,
      releasable_at=case when status='paused' and coalesce(o.dispute_deadline_at,now())<=now() then coalesce(releasable_at,now()) else releasable_at end,
      updated_at=now() where order_id=o.id;
    if p_liability='buyer' and p_matrix_code='buyer_address_or_misuse' then
      insert into public.user_incidents(user_id,order_id,claim_id,actor_role,incident_code,severity,notes,created_by)
      values(o.buyer_id,o.id,c.id,'buyer',p_matrix_code,1,btrim(p_reason),(select auth.uid()))
      on conflict(user_id,claim_id,incident_code) do update set status='confirmed',notes=excluded.notes,created_by=excluded.created_by,created_at=now(),reversed_at=null;
    end if;
  end if;

  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  values(o.buyer_id,o.id,'claim_decision','Decisión sobre tu reclamación',case when p_action='authorize_return' then 'Se autorizó la devolución. Revisa el pedido para conocer el plazo y registrar la guía.' else 'La reclamación fue rechazada mediante una decisión motivada. Puedes solicitar revisión dentro de tres días.' end,jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'appeal_deadline_at',r.appeal_deadline_at))
  on conflict do nothing;
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  values(o.seller_id,o.id,'claim_decision','Decisión sobre la reclamación',case when p_action='authorize_return' then 'Se autorizó la devolución. El saldo continúa retenido. Revisa la decisión y el plazo de revisión.' else 'La reclamación fue rechazada. El expediente conserva la decisión y su motivo.' end,jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'appeal_deadline_at',r.appeal_deadline_at,'seller_charge_selected',p_apply_seller_charge))
  on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(o.id,(select auth.uid()),'claim_decided',jsonb_build_object('claim_id',c.id,'resolution_id',r.id,'decision',p_action,'liability',p_liability,'matrix_code',p_matrix_code,'seller_charge_selected',p_apply_seller_charge,'seller_charge_estimate_mxn',v_charge,'final',p_final));

  return jsonb_build_object('resolution_id',r.id,'seller_charge_estimate_mxn',v_charge,'appeal_deadline_at',r.appeal_deadline_at,'status',r.status);
end;
$$;
revoke all on function public.admin_resolve_claim_v2(uuid,text,text,text,text,boolean,integer,integer,boolean) from public,anon;
grant execute on function public.admin_resolve_claim_v2(uuid,text,text,text,text,boolean,integer,integer,boolean) to authenticated;

create or replace function public.appeal_claim_resolution(p_claim_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare c public.claims; o public.orders; r public.claim_resolutions;
begin
  if char_length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Explica el motivo de revisión con al menos 10 caracteres'; end if;
  select * into c from public.claims where id=p_claim_id for update;
  if c.id is null then raise exception 'Reclamación inexistente'; end if;
  select * into o from public.orders where id=c.order_id for update;
  if (select auth.uid()) not in (o.buyer_id,o.seller_id) then raise exception 'No autorizado'; end if;
  select * into r from public.claim_resolutions where claim_id=c.id for update;
  if r.id is null or r.status<>'provisional' or now()>r.appeal_deadline_at then raise exception 'El plazo de revisión no está disponible'; end if;
  update public.claim_resolutions set status='appealed',appealed_at=now(),appeal_reason=btrim(p_reason),updated_at=now() where id=r.id;
  update public.claims set status='under_review',resolved_at=null where id=c.id;
  update public.orders set status='claim_open',updated_at=now() where id=o.id;
  update public.seller_payouts set status='paused',updated_at=now() where order_id=o.id and status in('held','releasable','requested');
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,(select auth.uid()),'claim_appealed',jsonb_build_object('claim_id',c.id,'resolution_id',r.id));
end;
$$;
revoke all on function public.appeal_claim_resolution(uuid,text) from public,anon;
grant execute on function public.appeal_claim_resolution(uuid,text) to authenticated;

create or replace function public.admin_waive_seller_debt(p_debt_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare d public.seller_debts; v_remaining integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Registra un motivo de al menos 10 caracteres'; end if;
  select * into d from public.seller_debts where id=p_debt_id for update;
  if d.id is null or d.status not in('open','partially_recovered') then raise exception 'Adeudo no disponible'; end if;
  v_remaining:=d.original_amount_mxn-d.recovered_amount_mxn;
  update public.seller_debts set status='waived',waived_at=now(),waived_by=(select auth.uid()),waiver_reason=btrim(p_reason),updated_at=now() where id=d.id;
  insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id,metadata)
  values(d.order_id,'adjustment',-v_remaining,'seller_debt_waiver',d.id::text,jsonb_build_object('reason',btrim(p_reason))) on conflict do nothing;
  insert into public.order_events(order_id,actor_id,event_type,metadata) values(d.order_id,(select auth.uid()),'seller_debt_waived',jsonb_build_object('debt_id',d.id,'amount_mxn',v_remaining,'reason',btrim(p_reason)));
  insert into public.notifications(user_id,order_id,kind,title,body,metadata)
  values(d.seller_id,d.order_id,'seller_debt_waived','Adeudo administrativo condonado','SECOND VOW condonó el saldo pendiente mediante una decisión administrativa registrada.',jsonb_build_object('debt_id',d.id,'amount_mxn',v_remaining)) on conflict do nothing;
end;
$$;
revoke all on function public.admin_waive_seller_debt(uuid,text) from public,anon;
grant execute on function public.admin_waive_seller_debt(uuid,text) to authenticated;

create or replace function public.admin_reverse_user_incident(p_incident_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare i public.user_incidents;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Registra un motivo de al menos 10 caracteres'; end if;
  select * into i from public.user_incidents where id=p_incident_id for update;
  if i.id is null or i.status<>'confirmed' then raise exception 'Incidencia no disponible'; end if;
  update public.user_incidents set status='reversed',reversed_at=now(),notes=notes||E'\nReversión: '||btrim(p_reason) where id=i.id;
  if i.order_id is not null then insert into public.order_events(order_id,actor_id,event_type,metadata) values(i.order_id,(select auth.uid()),'user_incident_reversed',jsonb_build_object('incident_id',i.id,'reason',btrim(p_reason))); end if;
end;
$$;
revoke all on function public.admin_reverse_user_incident(uuid,text) from public,anon;
grant execute on function public.admin_reverse_user_incident(uuid,text) to authenticated;

create or replace function public.request_seller_payout(p_order_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
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
    for d in select * from public.seller_debts where seller_id=p.seller_id and status in('open','partially_recovered') order by created_at for update loop
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
$$;
revoke all on function public.request_seller_payout(uuid) from public,anon;
grant execute on function public.request_seller_payout(uuid) to authenticated;

create or replace function public.backend_record_refund(p_order_id uuid,p_provider_refund_id text,p_amount_mxn integer,p_status text,p_reason_code text default 'other')
returns void language plpgsql security definer set search_path=''
as $$
declare o public.orders; v_payment uuid; c public.claims; r public.claim_resolutions; v_charge integer; v_debt integer;
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
$$;
revoke all on function public.backend_record_refund(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.backend_record_refund(uuid,text,integer,text,text) to service_role;

notify pgrst,'reload schema';
commit;
