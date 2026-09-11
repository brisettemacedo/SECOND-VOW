-- SECOND VOW 0037 — conserva todos los requisitos y vuelve no bloqueante la revisión de marca.
begin;

alter table public.dresses drop constraint if exists dresses_completa_antes_de_revision;
alter table public.dresses add constraint dresses_completa_antes_de_revision check (
  status in ('draft', 'changes_requested', 'rejected', 'archived')
  or (
    nullif(btrim(talla_etiqueta), '') is not null
    and silueta is not null and escote is not null and espalda is not null and manga is not null
    and condicion is not null and precio_venta_mxn is not null
    and envio_nacional = true
    and (brand_id is not null or brand_suggestion_id is not null)
  )
);

create or replace function public.submit_dress_for_review(p_dress_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_dress public.dresses;
begin
  select * into v_dress from public.dresses where id = p_dress_id for update;
  if v_dress.id is null then raise exception 'Publicación inexistente'; end if;
  if v_dress.seller_id <> auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if v_dress.status not in ('draft', 'changes_requested', 'rejected', 'pending_review') then raise exception 'La publicación ya fue enviada'; end if;
  if not exists (
    select 1 from public.dress_declarations x
    where x.dress_id = v_dress.id and x.seller_id = v_dress.seller_id
      and x.authenticity_declared and x.photos_correspond_declared
      and x.right_to_sell_declared and x.information_true_declared
  ) then raise exception 'Debes aceptar las declaraciones de publicación antes de publicar'; end if;
  if not exists (select 1 from public.dress_photos p where p.dress_id = v_dress.id) then raise exception 'Sube al menos una fotografía'; end if;
  if v_dress.brand_suggestion_id is not null and exists (
    select 1 from public.brand_suggestions bs where bs.id = v_dress.brand_suggestion_id and bs.status = 'rejected'
  ) then raise exception 'La marca sugerida fue rechazada. Selecciona o escribe otra marca'; end if;

  update public.dresses set status = 'approved', published_at = coalesce(published_at, now()), updated_at = now() where id = v_dress.id;
  insert into public.dress_moderation_history(dress_id, action, status_from, status_to, comments, admin_id)
  values (v_dress.id, 'approved', v_dress.status, 'approved',
    'Publicación automática completa; la marca sugerida puede confirmarse posteriormente.', coalesce(auth.uid(), v_dress.seller_id));
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
    nullif(btrim(d.talla_etiqueta), '') is null,
    d.silueta is null or d.escote is null or d.espalda is null or d.manga is null,
    d.condicion is null, d.precio_venta_mxn is null,
    not exists(select 1 from public.dress_photos p where p.dress_id=d.id),
    not exists(
      select 1 from public.dress_declarations x where x.dress_id=d.id and x.seller_id=d.seller_id
        and x.authenticity_declared and x.photos_correspond_declared
        and x.right_to_sell_declared and x.information_true_declared
    )
  from public.dresses d
  where d.status in ('draft','pending_review','changes_requested')
    and d.updated_at > now() - interval '365 days'
  order by d.updated_at desc;
end;
$$;
revoke all on function public.admin_list_stalled_drafts() from public, anon;
grant execute on function public.admin_list_stalled_drafts() to authenticated;

-- El nombre propuesto solo es visible para su dueña y para administración.
-- El catálogo público muestra una etiqueta neutra hasta que la administradora resuelva la sugerencia.
drop policy if exists "public reads pending brand of published dress" on public.brand_suggestions;

create or replace function public.admin_queue_draft_reminders(
  p_campaign text default '2026-09-11-publicacion-marca-no-bloqueante'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_inserted integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if nullif(btrim(p_campaign), '') is null then raise exception 'Campaña inválida'; end if;
  with latest as (
    select distinct on (d.seller_id) d.seller_id, d.id as dress_id, d.updated_at,
      count(*) over (partition by d.seller_id)::integer as draft_count
    from public.dresses d join public.profiles p on p.id=d.seller_id
    where d.status in ('draft','changes_requested','pending_review')
      and p.role='user' and coalesce(p.is_blocked,false)=false
    order by d.seller_id,d.updated_at desc
  )
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata,email_status)
  select l.seller_id,l.dress_id,'draft_publication_help',
    'Tu vestido está a un paso de publicarse 🤍',
    E'¡Hermosa!\n\nNo olvides terminar tu borrador para que tu vestido pueda publicarse y encontrar a su próxima novia. ✨\n\nCompleta todos los campos marcados con * y selecciona “Publicar vestido”. Si tu marca no aparece, escríbela y continúa: no necesitas esperar a que sea autorizada.\n\nAtentamente: SECOND VOW.',
    jsonb_build_object('campaign',p_campaign,'href_path','/publicar/'||l.dress_id::text,'draft_count',l.draft_count),
    'pending'
  from latest l on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.admin_queue_draft_reminders(text) from public, anon;
grant execute on function public.admin_queue_draft_reminders(text) to authenticated;

commit;
