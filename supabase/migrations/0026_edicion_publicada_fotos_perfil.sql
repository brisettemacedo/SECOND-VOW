-- SECOND VOW 0026 — edición segura de publicaciones y fotografías
begin;

create or replace view public.public_profiles with (security_barrier=true) as
select id, identity_verified, response_time_minutes, rating_average,
       nullif(btrim(full_name), '') as display_name
from public.profiles where is_blocked=false;
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

drop policy if exists "editar caracteristicas de vestido propio" on public.dress_characteristics;
create policy "editar caracteristicas de vestido propio" on public.dress_characteristics for insert to authenticated with check (
  public.is_active_user() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);
drop policy if exists "quitar caracteristicas de vestido propio" on public.dress_characteristics;
create policy "quitar caracteristicas de vestido propio" on public.dress_characteristics for delete to authenticated using (
  public.is_active_user() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);

drop policy if exists "insertar fotos de vestido propio" on public.dress_photos;
create policy "insertar fotos de vestido propio" on public.dress_photos for insert to authenticated with check (
  public.is_active_user() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);
drop policy if exists "actualizar fotos de vestido propio" on public.dress_photos;
create policy "actualizar fotos de vestido propio" on public.dress_photos for update to authenticated using (
  public.is_active_user() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
) with check (
  public.is_active_user() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);
drop policy if exists "borrar fotos de vestido propio" on public.dress_photos;
create policy "borrar fotos de vestido propio" on public.dress_photos for delete to authenticated using (
  public.is_active_user() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);

drop policy if exists "seller updates own draft declaration" on public.dress_declarations;
drop policy if exists "seller updates own editable declaration" on public.dress_declarations;
create policy "seller updates own editable declaration" on public.dress_declarations for update to authenticated using (
  seller_id=auth.uid() and exists (select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
) with check (seller_id=auth.uid());

create or replace function public.set_own_dress_primary_photo(p_photo_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_dress_id uuid;
begin
  select p.dress_id into v_dress_id from public.dress_photos p join public.dresses d on d.id=p.dress_id
  where p.id=p_photo_id and d.seller_id=auth.uid() and d.status in ('draft','pending_review','changes_requested','rejected','approved')
    and not public.dress_has_active_order(d.id) for update of p;
  if v_dress_id is null then raise exception 'photo_not_editable'; end if;
  update public.dress_photos set is_primary=false where dress_id=v_dress_id and is_primary;
  update public.dress_photos set is_primary=true where id=p_photo_id;
end $$;

create or replace function public.delete_own_dress_photo(p_photo_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_dress_id uuid; v_path text; v_primary boolean; v_status text; v_count integer;
begin
  select p.dress_id,p.storage_path,p.is_primary,d.status into v_dress_id,v_path,v_primary,v_status
  from public.dress_photos p join public.dresses d on d.id=p.dress_id
  where p.id=p_photo_id and d.seller_id=auth.uid() and d.status in ('draft','pending_review','changes_requested','rejected','approved')
    and not public.dress_has_active_order(d.id) for update of p;
  if v_dress_id is null then raise exception 'photo_not_editable'; end if;
  select count(*) into v_count from public.dress_photos where dress_id=v_dress_id;
  if v_status='approved' and v_count<=1 then raise exception 'published_dress_requires_photo'; end if;
  delete from public.dress_photos where id=p_photo_id;
  if v_primary then update public.dress_photos set is_primary=true where id=(select id from public.dress_photos where dress_id=v_dress_id order by position,id limit 1); end if;
  return v_path;
end $$;
revoke all on function public.set_own_dress_primary_photo(uuid) from public;
revoke all on function public.delete_own_dress_photo(uuid) from public;
grant execute on function public.set_own_dress_primary_photo(uuid) to authenticated;
grant execute on function public.delete_own_dress_photo(uuid) to authenticated;

drop policy if exists "imagenes vestido insertar carpeta propia" on storage.objects;
create policy "imagenes vestido insertar carpeta propia" on storage.objects for insert to authenticated with check (
  bucket_id='dress-images' and public.is_active_user() and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.dresses d where d.id::text=(storage.foldername(name))[2] and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);
drop policy if exists "imagenes vestido borrar carpeta propia" on storage.objects;
create policy "imagenes vestido borrar carpeta propia" on storage.objects for delete to authenticated using (
  bucket_id='dress-images' and public.is_active_user() and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.dresses d where d.id::text=(storage.foldername(name))[2] and d.seller_id=auth.uid()
    and d.status in ('draft','pending_review','changes_requested','rejected','approved') and not public.dress_has_active_order(d.id))
);

update public.dresses set removed_by_seller_at=coalesce(updated_at,now()) where status='archived' and removed_by_seller_at is null;
commit;
