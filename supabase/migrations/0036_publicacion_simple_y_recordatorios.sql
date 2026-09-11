-- SECOND VOW 0036 — publicación simple, marca no bloqueante y recordatorios únicos.
begin;

alter table public.dresses
  drop constraint if exists dresses_completa_antes_de_revision;

alter table public.dresses
  add constraint dresses_completa_antes_de_revision check (
    status in ('draft', 'changes_requested', 'rejected', 'archived')
    or (
      condicion is not null
      and precio_venta_mxn is not null
      and precio_venta_mxn > 0
      and envio_nacional = true
      and (brand_id is not null or brand_suggestion_id is not null)
    )
  );

create or replace function public.submit_dress_for_review(p_dress_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dress public.dresses;
begin
  select * into v_dress from public.dresses where id = p_dress_id for update;
  if v_dress.id is null then raise exception 'Publicación inexistente'; end if;
  if v_dress.seller_id <> auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if v_dress.status not in ('draft', 'changes_requested', 'rejected', 'pending_review') then
    raise exception 'La publicación ya fue enviada';
  end if;
  if v_dress.brand_id is null and v_dress.brand_suggestion_id is null then
    raise exception 'Selecciona una marca, usa Sin marca o escribe una nueva';
  end if;
  if v_dress.condicion is null then raise exception 'Selecciona la condición del vestido'; end if;
  if v_dress.precio_venta_mxn is null or v_dress.precio_venta_mxn <= 0 then
    raise exception 'Ingresa un precio de venta mayor a cero';
  end if;
  if not exists (select 1 from public.dress_photos p where p.dress_id = v_dress.id) then
    raise exception 'Sube al menos una fotografía';
  end if;
  if not exists (
    select 1 from public.dress_declarations x
    where x.dress_id = v_dress.id and x.seller_id = v_dress.seller_id
      and x.authenticity_declared and x.photos_correspond_declared
      and x.right_to_sell_declared and x.information_true_declared
  ) then
    raise exception 'Debes aceptar las declaraciones de publicación antes de publicar';
  end if;
  if v_dress.brand_suggestion_id is not null and exists (
    select 1 from public.brand_suggestions bs
    where bs.id = v_dress.brand_suggestion_id and bs.status = 'rejected'
  ) then
    raise exception 'La marca sugerida fue rechazada. Selecciona o escribe otra marca';
  end if;

  update public.dresses
  set status = 'approved', published_at = coalesce(published_at, now()), updated_at = now()
  where id = v_dress.id;

  insert into public.dress_moderation_history(dress_id, action, status_from, status_to, comments, admin_id)
  values (v_dress.id, 'approved', v_dress.status, 'approved',
    'Publicación automática: marca, condición, precio, fotografía y declaraciones completos.',
    coalesce(auth.uid(), v_dress.seller_id));
  return 'approved';
end;
$$;
revoke all on function public.submit_dress_for_review(uuid) from public, anon;
grant execute on function public.submit_dress_for_review(uuid) to authenticated;

create or replace function public.admin_list_stalled_drafts()
returns table (
  id uuid, seller_id uuid, brand_id uuid, brand_suggestion_id uuid, model text, status text, updated_at timestamptz,
  falta_talla boolean, falta_diseno boolean, falta_condicion boolean, falta_precio boolean,
  falta_fotos boolean, falta_declaraciones boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return query
  select d.id, d.seller_id, d.brand_id, d.brand_suggestion_id, d.model, d.status, d.updated_at,
    false, false,
    d.condicion is null,
    d.precio_venta_mxn is null or d.precio_venta_mxn <= 0,
    not exists(select 1 from public.dress_photos p where p.dress_id = d.id),
    not exists(
      select 1 from public.dress_declarations x
      where x.dress_id = d.id and x.seller_id = d.seller_id
        and x.authenticity_declared and x.photos_correspond_declared
        and x.right_to_sell_declared and x.information_true_declared
    )
  from public.dresses d
  where d.status in ('draft','changes_requested','pending_review')
    and d.updated_at > now() - interval '365 days'
  order by d.updated_at desc;
end;
$$;
revoke all on function public.admin_list_stalled_drafts() from public, anon;
grant execute on function public.admin_list_stalled_drafts() to authenticated;

-- Los borradores son trabajo de la usuaria, no una autorización administrativa.
create or replace function public.admin_list_pending_items()
returns table(tipo text, etiqueta text, url text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return query
  select 'marca', 'Revisar marca: ' || bs.suggested_name, '/admin#marcas', bs.created_at
    from public.brand_suggestions bs where bs.status = 'pending'
  union all
  select 'pedido_vencido', 'Pedido vencido sin cerrar: ' || coalesce(o.public_code,o.id::text), '/pedidos/'||o.id::text, o.updated_at
    from public.orders o where o.status in('awaiting_payment','payment_processing') and o.payment_deadline_at < now()
  union all
  select 'pago', 'Excepción de pago: ' || pe.exception_type, '/admin#pagos', pe.created_at
    from public.payment_exceptions pe where pe.status = 'open'
  union all
  select 'cancelacion', 'Cancelación o pago fallido: ' || coalesce(o.public_code,o.id::text), '/pedidos/'||o.id::text, o.updated_at
    from public.orders o where o.payment_failure_code is not null and o.updated_at > now() - interval '14 days'
  union all
  select 'reclamacion', 'Reclamación abierta', '/admin#reclamaciones', c.created_at
    from public.claims c where c.status in('open','under_review','refund_pending')
  order by created_at asc;
end;
$$;
revoke all on function public.admin_list_pending_items() from public, anon;
grant execute on function public.admin_list_pending_items() to authenticated;

create unique index if not exists notifications_draft_campaign_unique
  on public.notifications(user_id, kind, ((metadata->>'campaign')))
  where kind = 'draft_publication_help' and metadata ? 'campaign';

create or replace function public.admin_queue_draft_reminders(
  p_campaign text default '2026-09-11-publicacion-simple'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_inserted integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if nullif(btrim(p_campaign), '') is null then raise exception 'Campaña inválida'; end if;

  with latest as (
    select distinct on (d.seller_id)
      d.seller_id, d.id as dress_id, d.updated_at,
      count(*) over (partition by d.seller_id)::integer as draft_count
    from public.dresses d
    join public.profiles p on p.id = d.seller_id
    where d.status in ('draft','changes_requested','pending_review')
      and p.role = 'user' and coalesce(p.is_blocked, false) = false
    order by d.seller_id, d.updated_at desc
  )
  insert into public.notifications(user_id, dress_id, kind, title, body, metadata, email_status)
  select l.seller_id, l.dress_id, 'draft_publication_help',
    'Tu vestido está a un paso de publicarse 🤍',
    E'¡Hermosa!\n\nNo olvides terminar tu borrador para que tu vestido pueda publicarse y venderse más rápido a su próxima novia. ✨\n\nCompleta los campos marcados con * y selecciona “Publicar vestido”. Los demás datos son opcionales.\n\nAtentamente: SECOND VOW.',
    jsonb_build_object('campaign', p_campaign, 'href_path', '/publicar/' || l.dress_id::text, 'draft_count', l.draft_count),
    'pending'
  from latest l
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.admin_queue_draft_reminders(text) from public, anon;
grant execute on function public.admin_queue_draft_reminders(text) to authenticated;

commit;
