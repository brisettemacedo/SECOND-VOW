-- SECOND VOW 0031
-- Permite bloquear el saldo cuando la paquetería reporta entrega pero la
-- compradora manifiesta oportunamente que no recibió el paquete.

alter table public.claims drop constraint if exists claims_reason_code_check;
alter table public.claims add constraint claims_reason_code_check check (
  reason_code is null or reason_code in (
    'not_received',
    'false_or_materially_incorrect',
    'damaged_undisclosed'
  )
);

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
begin
  select * into o
  from public.orders
  where id=p_order_id
  for update;

  if o.id is null or o.buyer_id<>(select auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if o.platform_delivery_recorded_at is null then
    raise exception 'La entrega todavía no ha sido registrada por SECOND VOW';
  end if;
  if now()>coalesce(o.dispute_deadline_at,o.platform_delivery_recorded_at+interval '48 hours') then
    raise exception 'El plazo de 48 horas venció y operó la aceptación automática';
  end if;
  if p_reason_code not in('not_received','false_or_materially_incorrect','damaged_undisclosed') then
    raise exception 'Motivo de reclamación no cubierto';
  end if;
  if nullif(btrim(p_description),'') is null then
    raise exception 'Describe concretamente lo ocurrido';
  end if;
  if exists (
    select 1 from public.claims c
    where c.order_id=o.id
      and c.status not in('rejected','closed','refunded')
  ) then
    raise exception 'Ya existe una reclamación activa';
  end if;

  insert into public.claims(order_id,opened_by,reason,reason_code,description,status)
  values(o.id,(select auth.uid()),p_reason_code,p_reason_code,btrim(p_description),'open')
  returning id into v_claim;

  update public.orders
  set status='claim_open',updated_at=now()
  where id=o.id;

  update public.seller_payouts
  set status='paused',updated_at=now()
  where order_id=o.id
    and status in('held','releasable','requested');

  insert into public.notifications(user_id,order_id,kind,title,body)
  values(
    o.seller_id,
    o.id,
    'claim_opened',
    'Reclamación abierta',
    case when p_reason_code='not_received'
      then 'La compradora reportó que no recibió el paquete. El saldo permanece bloqueado mientras SECOND VOW revisa el rastreo y la constancia de entrega.'
      else 'El saldo permanece bloqueado mientras se revisa la reclamación y su evidencia.'
    end
  )
  on conflict do nothing;

  insert into public.order_events(order_id,actor_id,event_type,metadata)
  values(
    o.id,
    (select auth.uid()),
    'claim_opened',
    jsonb_build_object('claim_id',v_claim,'reason',p_reason_code)
  );

  return v_claim;
end
$$;

revoke all on function public.open_order_claim(uuid,text,text) from public;
grant execute on function public.open_order_claim(uuid,text,text) to authenticated;
