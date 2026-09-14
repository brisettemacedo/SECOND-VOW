-- SECOND VOW 0043 — restringe evidencia reservada a la vendedora
begin;

create index if not exists idx_claims_active_reply_deadline
  on public.claims(status,seller_response_due_at)
  where status in('open','under_review','seller_response');

create or replace function public.guard_claim_evidence_actor()
returns trigger
language plpgsql
set search_path=''
as $$
declare o public.orders;
begin
  if new.uploaded_by<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  select * into o from public.orders where id=new.order_id;
  if new.evidence_type in('seller_claim_response','seller_return_label') and o.seller_id<>(select auth.uid()) then
    raise exception 'Este archivo solo puede cargarlo la vendedora';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_claim_evidence_actor() from public,anon,authenticated;
drop trigger if exists guard_claim_evidence_actor on public.order_evidence;
create trigger guard_claim_evidence_actor
before insert on public.order_evidence
for each row execute function public.guard_claim_evidence_actor();

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
revoke all on function public.guard_claim_resolution_due_process() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
