-- ============================================================
-- SECOND VOW — 0010 · Pagos y retiros con Stripe Connect
-- Ejecutar DESPUÉS de 0009.
-- Capa de DATOS: las llamadas reales a Stripe viven en backend seguro.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- DECISIÓN COMERCIAL INICIAL
-- · Publicar: $0.
-- · Comisión a vendedora: 15% del precio del vestido.
-- · Cargo administrativo fijo: $19 MXN por venta completada.
-- · Compradora: paga precio + envío; sin buyer fee inicial.
-- · Envío: lo organiza la vendedora con su paquetería; carga rastreo.
-- · Stripe: la vendedora NO necesita una cuenta Stripe preexistente.
--   SECOND VOW crea una cuenta Connect técnica y Stripe recopila banco/KYC.
-- · Pago a vendedora: no se libera al banco hasta terminar 72h de inspección.
-- ------------------------------------------------------------

-- 1) Configuración comercial versionada.
create table if not exists public.marketplace_fee_configs (
  id uuid primary key default gen_random_uuid(),
  seller_commission_bps integer not null default 1500,
  seller_admin_fixed_mxn integer not null default 19,
  listing_fee_mxn integer not null default 0,
  buyer_protection_bps integer not null default 0,
  buyer_protection_fixed_mxn integer not null default 0,
  processor_fee_borne_by text not null default 'seller',
  shipping_payer text not null default 'buyer',
  shipping_model text not null default 'seller_arranged',
  charge_model text not null default 'direct_charge_manual_payout',
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint fee_seller_bps_check check(seller_commission_bps between 0 and 5000),
  constraint fee_seller_admin_check check(seller_admin_fixed_mxn>=0),
  constraint fee_listing_check check(listing_fee_mxn>=0),
  constraint fee_buyer_bps_check check(buyer_protection_bps between 0 and 5000),
  constraint fee_buyer_fixed_check check(buyer_protection_fixed_mxn>=0),
  constraint fee_processor_bearer_check check(processor_fee_borne_by in('seller','platform')),
  constraint fee_shipping_payer_check check(shipping_payer in('buyer','seller')),
  constraint fee_shipping_model_check check(shipping_model='seller_arranged'),
  constraint fee_charge_model_check check(charge_model in('direct_charge_manual_payout')),
  constraint fee_dates_check check(effective_until is null or effective_until>effective_from)
);

-- Si la tabla ya existe por una prueba previa de 0010, completar columnas.
alter table public.marketplace_fee_configs add column if not exists seller_admin_fixed_mxn integer not null default 19;
alter table public.marketplace_fee_configs add column if not exists listing_fee_mxn integer not null default 0;
alter table public.marketplace_fee_configs add column if not exists processor_fee_borne_by text not null default 'seller';
alter table public.marketplace_fee_configs add column if not exists shipping_payer text not null default 'buyer';
alter table public.marketplace_fee_configs add column if not exists shipping_model text not null default 'seller_arranged';
alter table public.marketplace_fee_configs add column if not exists charge_model text not null default 'direct_charge_manual_payout';

-- Desactivar configuraciones sembradas anteriores y activar la política inicial nueva.
update public.marketplace_fee_configs set is_active=false where is_active=true;
insert into public.marketplace_fee_configs(
  seller_commission_bps,seller_admin_fixed_mxn,listing_fee_mxn,
  buyer_protection_bps,buyer_protection_fixed_mxn,
  processor_fee_borne_by,shipping_payer,shipping_model,charge_model,is_active
) values(1500,19,0,0,0,'seller','buyer','seller_arranged','direct_charge_manual_payout',true);

-- 2) Cuenta bancaria/payout de la vendedora.
-- provider_account_id es la cuenta Connect técnica. La usuaria no necesita
-- haberse registrado antes en Stripe. No guardamos CLABE completa ni documentos.
create table if not exists public.seller_payment_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'stripe',
  provider_account_id text unique,
  onboarding_status text not null default 'not_started',
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  bank_account_linked boolean not null default false,
  bank_name text,
  bank_last4 text,
  requirements_due jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_payment_provider_check check(provider='stripe'),
  constraint seller_payment_onboarding_check check(onboarding_status in(
    'not_started','pending','restricted','complete','disabled'
  )),
  constraint seller_payment_bank_last4_check check(bank_last4 is null or char_length(bank_last4)=4)
);

alter table public.seller_payment_accounts add column if not exists bank_account_linked boolean not null default false;
alter table public.seller_payment_accounts add column if not exists bank_name text;
alter table public.seller_payment_accounts add column if not exists bank_last4 text;

-- 3) Snapshot financiero del pedido.
alter table public.orders add column if not exists currency text not null default 'MXN';
alter table public.orders add column if not exists fee_config_id uuid references public.marketplace_fee_configs(id);
alter table public.orders add column if not exists seller_commission_bps integer;
alter table public.orders add column if not exists seller_admin_fee_mxn integer not null default 0;
alter table public.orders add column if not exists buyer_protection_bps integer not null default 0;
alter table public.orders add column if not exists buyer_protection_fee_mxn integer not null default 0;
alter table public.orders add column if not exists processor_fee_mxn integer;
alter table public.orders add column if not exists seller_net_after_processor_mxn integer;
alter table public.orders add column if not exists amount_charged_mxn integer;
alter table public.orders add column if not exists seller_transfer_mxn integer;
alter table public.orders add column if not exists stripe_payment_intent_id text;
alter table public.orders add column if not exists stripe_charge_id text;
alter table public.orders add column if not exists stripe_checkout_session_id text;
alter table public.orders add column if not exists payment_failure_code text;

alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check check(currency='MXN');

create unique index if not exists orders_stripe_payment_intent_unique on public.orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists orders_stripe_checkout_session_unique on public.orders(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

-- 4) Payments: referencias e idempotencia.
alter table public.payments add column if not exists currency text not null default 'MXN';
alter table public.payments add column if not exists provider_payment_intent_id text;
alter table public.payments add column if not exists provider_charge_id text;
alter table public.payments add column if not exists provider_checkout_session_id text;
alter table public.payments add column if not exists failure_code text;
alter table public.payments add column if not exists failure_message text;
alter table public.payments add column if not exists paid_at timestamptz;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check(status in(
  'pending','requires_payment_method','requires_action','processing','authorized','paid',
  'failed','cancelled','partially_refunded','refunded'
));
create unique index if not exists payments_provider_intent_unique on public.payments(provider,provider_payment_intent_id) where provider_payment_intent_id is not null;

-- 5) Saldo/retiro de la vendedora.
-- El pago bancario real se solicita desde SECOND VOW. El backend crea el payout
-- en la cuenta Connect; la usuaria nunca necesita entrar al Dashboard de Stripe.
create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  seller_id uuid not null references public.profiles(id),
  provider text not null default 'stripe',
  connected_account_id text,
  payout_id text unique,
  amount_mxn integer not null check(amount_mxn>=0),
  status text not null default 'held',
  releasable_at timestamptz,
  requested_at timestamptz,
  processing_at timestamptz,
  paid_out_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_payout_provider_check check(provider='stripe'),
  constraint seller_payout_status_check check(status in(
    'held','releasable','requested','processing','paid_out','paused','failed','reversed'
  ))
);
alter table public.seller_payouts add column if not exists requested_at timestamptz;
alter table public.seller_payouts add column if not exists processing_at timestamptz;
create index if not exists idx_seller_payouts_release on public.seller_payouts(status,releasable_at);

-- 6) Reembolsos.
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null default 'stripe',
  provider_refund_id text unique,
  amount_mxn integer not null check(amount_mxn>0),
  reason_code text not null,
  status text not null default 'pending',
  initiated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint refunds_reason_check check(reason_code in('order_cancelled','claim_approved','duplicate','fraud','other')),
  constraint refunds_status_check check(status in('pending','processing','succeeded','failed','cancelled'))
);

-- 7) Ledger interno para conciliación.
create table if not exists public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  entry_type text not null,
  amount_mxn integer not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_ledger_type_check check(entry_type in(
    'buyer_charge','shipping_charge','seller_commission','seller_admin_fee','processor_fee',
    'seller_payout','refund','payout_reversal','adjustment'
  ))
);
create index if not exists idx_payment_ledger_order on public.payment_ledger(order_id,created_at);

-- 8) Webhooks idempotentes.
create table if not exists public.payment_webhook_events (
  provider text not null default 'stripe',
  event_id text not null,
  event_type text not null,
  payload jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  primary key(provider,event_id),
  constraint payment_webhook_provider_check check(provider='stripe')
);

-- 9) Snapshot antes del checkout.
create or replace function public.prepare_order_financials(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  f public.marketplace_fee_configs;
  v_commission integer;
  v_admin integer;
  v_buyer_fee integer;
  v_seller_before_processor integer;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente';end if;
  if o.buyer_id<>auth.uid() and auth.role()<>'service_role' and not public.is_admin() then raise exception 'No autorizado';end if;
  if o.status<>'awaiting_payment' then raise exception 'El pedido no está pendiente de pago';end if;
  if o.shipping_quote_set_at is null then raise exception 'La vendedora debe cotizar el envío antes del pago';end if;

  select * into f from public.marketplace_fee_configs
  where is_active=true and effective_from<=now() and(effective_until is null or effective_until>now())
  order by effective_from desc limit 1;
  if f.id is null then raise exception 'No existe configuración de tarifas activa';end if;

  v_commission:=round(o.subtotal_mxn*f.seller_commission_bps/10000.0);
  v_admin:=f.seller_admin_fixed_mxn;
  v_buyer_fee:=round(o.subtotal_mxn*f.buyer_protection_bps/10000.0)+f.buyer_protection_fixed_mxn;
  -- El envío se transfiere íntegro a la vendedora; no lleva comisión porcentual.
  v_seller_before_processor:=greatest(0,o.subtotal_mxn-v_commission-v_admin+o.shipping_mxn);

  update public.orders
  set fee_config_id=f.id,
      seller_commission_bps=f.seller_commission_bps,
      buyer_protection_bps=f.buyer_protection_bps,
      commission_mxn=v_commission,
      seller_admin_fee_mxn=v_admin,
      buyer_protection_fee_mxn=v_buyer_fee,
      seller_net_mxn=v_seller_before_processor,
      seller_transfer_mxn=v_seller_before_processor,
      total_mxn=o.subtotal_mxn+o.shipping_mxn+v_buyer_fee,
      amount_charged_mxn=o.subtotal_mxn+o.shipping_mxn+v_buyer_fee,
      updated_at=now()
  where id=o.id returning * into o;

  return o;
end;
$$;
revoke all on function public.prepare_order_financials(uuid) from public;
grant execute on function public.prepare_order_financials(uuid) to authenticated;

-- 10) Backend: confirmar cobro real desde webhook Stripe.
create or replace function public.backend_mark_payment_paid(
  p_order_id uuid,
  p_payment_intent_id text,
  p_charge_id text,
  p_checkout_session_id text,
  p_processor_fee_mxn integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o public.orders; v_payment uuid; v_final_net integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend';end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente';end if;

  v_final_net:=greatest(0,coalesce(o.seller_transfer_mxn,o.seller_net_mxn)-coalesce(p_processor_fee_mxn,0));

  update public.orders
  set status='paid',payment_provider='stripe',payment_reference=p_payment_intent_id,
      stripe_payment_intent_id=p_payment_intent_id,stripe_charge_id=p_charge_id,
      stripe_checkout_session_id=p_checkout_session_id,processor_fee_mxn=p_processor_fee_mxn,
      seller_net_after_processor_mxn=v_final_net,
      paid_at=coalesce(paid_at,now()),seller_ship_by=coalesce(seller_ship_by,now()+interval '4 days'),updated_at=now()
  where id=o.id;

  insert into public.payments(order_id,provider,provider_reference,status,amount_mxn,currency,
    provider_payment_intent_id,provider_charge_id,provider_checkout_session_id,paid_at)
  values(o.id,'stripe',p_payment_intent_id,'paid',coalesce(o.amount_charged_mxn,o.total_mxn),'MXN',
    p_payment_intent_id,p_charge_id,p_checkout_session_id,now())
  on conflict(provider,provider_payment_intent_id) where provider_payment_intent_id is not null
  do update set status='paid',provider_charge_id=excluded.provider_charge_id,paid_at=coalesce(public.payments.paid_at,excluded.paid_at),updated_at=now()
  returning id into v_payment;

  insert into public.seller_payouts(order_id,seller_id,amount_mxn,status)
  values(o.id,o.seller_id,v_final_net,'held')
  on conflict(order_id) do update set amount_mxn=excluded.amount_mxn,updated_at=now();

  insert into public.payment_ledger(order_id,entry_type,amount_mxn,reference_type,reference_id)
  values(o.id,'buyer_charge',coalesce(o.amount_charged_mxn,o.total_mxn),'payment_intent',p_payment_intent_id);
  insert into public.payment_ledger(order_id,entry_type,amount_mxn)
  values(o.id,'seller_commission',o.commission_mxn),
        (o.id,'seller_admin_fee',o.seller_admin_fee_mxn),
        (o.id,'shipping_charge',o.shipping_mxn);
  if p_processor_fee_mxn is not null then
    insert into public.payment_ledger(order_id,entry_type,amount_mxn) values(o.id,'processor_fee',p_processor_fee_mxn);
  end if;
end;
$$;
revoke all on function public.backend_mark_payment_paid(uuid,text,text,text,integer) from public;

-- 11) Backend: al terminar la ventana de 72h, saldo pasa a liberable.
create or replace function public.backend_mark_payout_releasable(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o public.orders;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend';end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente';end if;
  if exists(select 1 from public.claims c where c.order_id=o.id and c.status not in('rejected','closed','refunded')) then raise exception 'Existe una reclamación activa';end if;
  if o.payout_release_at is null or o.payout_release_at>now() then raise exception 'El pago todavía no es liberable';end if;
  update public.seller_payouts set status='releasable',releasable_at=now(),updated_at=now()
  where order_id=o.id and status='held';
end;
$$;
revoke all on function public.backend_mark_payout_releasable(uuid) from public;

-- 12) La vendedora solicita retiro desde SECOND VOW.
-- Esta función NO toca el banco. Solo crea la solicitud segura; el backend
-- llama a Stripe y después registra payout_id mediante webhook/API.
create or replace function public.request_seller_payout(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare p public.seller_payouts; a public.seller_payment_accounts;
begin
  select * into p from public.seller_payouts where order_id=p_order_id for update;
  if p.id is null or p.seller_id<>auth.uid() then raise exception 'No autorizado';end if;
  if p.status<>'releasable' then raise exception 'El saldo todavía no está disponible para retiro';end if;
  select * into a from public.seller_payment_accounts where user_id=auth.uid();
  if a.user_id is null or a.onboarding_status<>'complete' or not a.payouts_enabled or not a.bank_account_linked then
    raise exception 'Primero vincula y verifica tu cuenta bancaria';
  end if;
  update public.seller_payouts set status='requested',requested_at=now(),connected_account_id=a.provider_account_id,updated_at=now()
  where id=p.id returning * into p;
  return p.id;
end;
$$;
revoke all on function public.request_seller_payout(uuid) from public;
grant execute on function public.request_seller_payout(uuid) to authenticated;

-- 13) Backend actualiza payout bancario real.
create or replace function public.backend_update_payout(
  p_payout_row_id uuid,
  p_status text,
  p_provider_payout_id text default null,
  p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend';end if;
  if p_status not in('processing','paid_out','failed','reversed') then raise exception 'Estado inválido';end if;
  update public.seller_payouts
  set status=p_status,payout_id=coalesce(p_provider_payout_id,payout_id),failure_code=p_failure_code,
      processing_at=case when p_status='processing' then coalesce(processing_at,now()) else processing_at end,
      paid_out_at=case when p_status='paid_out' then coalesce(paid_out_at,now()) else paid_out_at end,
      updated_at=now()
  where id=p_payout_row_id;
end;
$$;
revoke all on function public.backend_update_payout(uuid,text,text,text) from public;

-- 14) RLS financiera.
alter table public.marketplace_fee_configs enable row level security;
alter table public.seller_payment_accounts enable row level security;
alter table public.seller_payouts enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_ledger enable row level security;
alter table public.payment_webhook_events enable row level security;

drop policy if exists "read active marketplace fees" on public.marketplace_fee_configs;
create policy "read active marketplace fees" on public.marketplace_fee_configs for select to authenticated using(is_active=true or public.is_admin());
drop policy if exists "admin manages marketplace fees" on public.marketplace_fee_configs;
create policy "admin manages marketplace fees" on public.marketplace_fee_configs for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "seller reads own payment account" on public.seller_payment_accounts;
create policy "seller reads own payment account" on public.seller_payment_accounts for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "seller reads own payouts" on public.seller_payouts;
create policy "seller reads own payouts" on public.seller_payouts for select to authenticated using(seller_id=auth.uid() or public.is_admin());

drop policy if exists "parties read refunds" on public.refunds;
create policy "parties read refunds" on public.refunds for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())));
drop policy if exists "seller reads order ledger" on public.payment_ledger;
create policy "seller reads order ledger" on public.payment_ledger for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())));

revoke all on public.marketplace_fee_configs,public.seller_payment_accounts,public.seller_payouts,public.refunds,public.payment_ledger,public.payment_webhook_events from anon,authenticated;
grant select on public.marketplace_fee_configs,public.seller_payment_accounts,public.seller_payouts,public.refunds,public.payment_ledger to authenticated;

commit;
