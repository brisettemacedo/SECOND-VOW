-- Recordatorios personalizados de borradores y eliminación segura antes de aceptar una oferta.
begin;

create or replace function public.remove_own_dress_listing(p_dress_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare d public.dresses;
begin
  select * into d from public.dresses where id=p_dress_id for update;
  if d.id is null or d.seller_id<>auth.uid() then raise exception 'No autorizado'; end if;
  if d.status in ('reserved','sold')
     or exists(select 1 from public.offers o where o.dress_id=d.id and o.status='accepted')
     or exists(select 1 from public.orders o where o.dress_id=d.id and o.status not in('cancelled','refunded','completed')) then
    raise exception 'No puedes eliminar la publicación porque ya aceptaste una oferta o existe una operación activa';
  end if;

  update public.offers set status='cancelled', updated_at=now()
    where dress_id=d.id and status='pending';
  update public.dresses set status='archived', removed_by_seller_at=now(), updated_at=now()
    where id=d.id;
  return 'removed';
end$$;
revoke all on function public.remove_own_dress_listing(uuid) from public, anon;
grant execute on function public.remove_own_dress_listing(uuid) to authenticated;

create or replace function public.admin_queue_draft_reminders(
  p_campaign text default '2026-09-16-borradores-incompletos-v2'
) returns integer
language plpgsql security definer set search_path='' as $$
declare v_inserted integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if nullif(btrim(p_campaign),'') is null then raise exception 'Campaña inválida'; end if;

  with candidates as (
    select d.*,
      array_remove(array[
        case when d.brand_id is null and d.brand_suggestion_id is null then 'marca' end,
        case when nullif(btrim(d.talla_etiqueta),'') is null then 'talla' end,
        case when d.silueta is null or d.escote is null or d.espalda is null or d.manga is null then 'diseño' end,
        case when d.condicion is null then 'condición' end,
        case when d.precio_venta_mxn is null then 'precio' end,
        case when not exists(select 1 from public.dress_photos ph where ph.dress_id=d.id) then 'fotografías' end,
        case when not exists(select 1 from public.dress_declarations x where x.dress_id=d.id and x.seller_id=d.seller_id
          and x.authenticity_declared and x.photos_correspond_declared and x.right_to_sell_declared and x.information_true_declared)
          then 'declaraciones finales' end
      ],null) missing_fields,
      count(*) over(partition by d.seller_id)::integer draft_count
    from public.dresses d join public.profiles p on p.id=d.seller_id
    where d.status in ('draft','changes_requested','pending_review')
      and d.removed_by_seller_at is null
      and p.role='user' and coalesce(p.is_blocked,false)=false
      and d.updated_at < now()-interval '24 hours'
      and d.updated_at > now()-interval '365 days'
  ), latest as (
    select distinct on(seller_id) * from candidates order by seller_id,updated_at desc
  )
  insert into public.notifications(user_id,dress_id,kind,title,body,metadata,email_status)
  select l.seller_id,l.id,'draft_publication_help',
    'Tu vestido está a un paso de publicarse 🤍',
    E'¡Hermosa!\n\nNo olvides terminar tu borrador para que tu vestido pueda publicarse y encontrar a su próxima novia. ✨\n\nA tu borrador le falta: '
      || array_to_string(l.missing_fields,', ')
      || E'.\n\nCompleta todos los campos marcados con * y selecciona “Publicar vestido”. Si tu marca no aparece, escríbela y continúa: no necesitas esperar a que sea autorizada.\n\nAtentamente: SECOND VOW.',
    jsonb_build_object('campaign',p_campaign,'href_path','/publicar/'||l.id::text,'draft_count',l.draft_count,'missing_fields',to_jsonb(l.missing_fields)),
    'pending'
  from latest l
  where cardinality(l.missing_fields)>0
  on conflict do nothing;
  get diagnostics v_inserted=row_count;
  return v_inserted;
end$$;
revoke all on function public.admin_queue_draft_reminders(text) from public, anon;
grant execute on function public.admin_queue_draft_reminders(text) to authenticated;

commit;
