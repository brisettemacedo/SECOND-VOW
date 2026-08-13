-- ============================================================
-- SECOND VOW 0015 - Operación segura, evidencia y checkout backend
-- Ejecutar DESPUÉS de 0014.
-- ============================================================
begin;

create table if not exists public.order_evidence(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  evidence_type text not null,
  storage_path text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint order_evidence_type_check check(evidence_type in(
    'seller_pre_ship','seller_packed','seller_shipping_receipt',
    'buyer_package_received','buyer_unboxing','buyer_dress_received','other'
  ))
);
create index if not exists idx_order_evidence_order on public.order_evidence(order_id,created_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-evidence','order-evidence',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4','application/pdf']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.order_evidence enable row level security;
drop policy if exists "order parties read evidence" on public.order_evidence;
create policy "order parties read evidence" on public.order_evidence for select to authenticated using(
  exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin()))
);
drop policy if exists "order parties insert own evidence" on public.order_evidence;
create policy "order parties insert own evidence" on public.order_evidence for insert to authenticated with check(
  uploaded_by=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id))
);
revoke all on public.order_evidence from anon;
grant select,insert on public.order_evidence to authenticated;

-- Storage: cada usuaria escribe solo bajo su carpeta user_id/order_id/archivo.
drop policy if exists "order evidence own insert" on storage.objects;
create policy "order evidence own insert" on storage.objects for insert to authenticated with check(
  bucket_id='order-evidence' and (storage.foldername(name))[1]=auth.uid()::text
);
drop policy if exists "order evidence parties read" on storage.objects;
create policy "order evidence parties read" on storage.objects for select to authenticated using(
  bucket_id='order-evidence' and exists(
    select 1 from public.order_evidence e join public.orders o on o.id=e.order_id
    where e.storage_path=name and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())
  )
);

-- Snapshot financiero ejecutado únicamente por backend service_role.
create or replace function public.backend_prepare_order_financials(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path=''
as $$
declare o public.orders; f public.marketplace_fee_configs; v_commission integer; v_admin integer; v_buyer_fee integer; v_seller integer;
begin
  if auth.role()<>'service_role' then raise exception 'Solo backend'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Pedido inexistente'; end if;
  if o.status<>'awaiting_payment' then raise exception 'El pedido no está pendiente de pago'; end if;
  if o.shipping_quote_set_at is null then raise exception 'La vendedora debe cotizar el envío antes del pago'; end if;
  select * into f from public.marketplace_fee_configs where is_active=true and effective_from<=now() and(effective_until is null or effective_until>now()) order by effective_from desc limit 1;
  if f.id is null then raise exception 'No existe configuración de tarifas activa'; end if;
  v_commission:=round(o.subtotal_mxn*f.seller_commission_bps/10000.0);
  v_admin:=f.seller_admin_fixed_mxn;
  v_buyer_fee:=round(o.subtotal_mxn*f.buyer_protection_bps/10000.0)+f.buyer_protection_fixed_mxn;
  v_seller:=greatest(0,o.subtotal_mxn-v_commission-v_admin+o.shipping_mxn);
  update public.orders set fee_config_id=f.id,seller_commission_bps=f.seller_commission_bps,buyer_protection_bps=f.buyer_protection_bps,commission_mxn=v_commission,seller_admin_fee_mxn=v_admin,buyer_protection_fee_mxn=v_buyer_fee,seller_net_mxn=v_seller,seller_transfer_mxn=v_seller,total_mxn=o.subtotal_mxn+o.shipping_mxn+v_buyer_fee,amount_charged_mxn=o.subtotal_mxn+o.shipping_mxn+v_buyer_fee,updated_at=now() where id=o.id returning * into o;
  return o;
end;$$;
revoke all on function public.backend_prepare_order_financials(uuid) from public;

commit;
