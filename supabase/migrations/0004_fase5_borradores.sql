-- ============================================================
-- SECOND VOW — 0004 · Borradores y envío a revisión corregidos
-- Requiere 0001, 0002 y 0003.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Compatibilidad con el esquema original de Fase 3:
-- los borradores deben admitir campos incompletos.
-- ------------------------------------------------------------
alter table public.dresses alter column talla_etiqueta drop not null;
alter table public.dresses alter column silueta drop not null;
alter table public.dresses alter column escote drop not null;
alter table public.dresses alter column espalda drop not null;
alter table public.dresses alter column manga drop not null;
alter table public.dresses alter column tela_principal drop not null;
alter table public.dresses alter column color_principal drop not null;
alter table public.dresses alter column cola drop not null;
alter table public.dresses alter column condicion drop not null;
alter table public.dresses alter column precio_venta_mxn drop not null;
alter table public.dresses alter column ciudad drop not null;
alter table public.dresses alter column estado drop not null;

alter table public.dresses
  drop constraint if exists dresses_precio_venta_mxn_check;

alter table public.dresses
  drop constraint if exists dresses_prices_valid;

alter table public.dresses
  add constraint dresses_prices_valid check (
    (precio_original_mxn is null or precio_original_mxn > 0)
    and (precio_venta_mxn is null or precio_venta_mxn > 0)
  );

-- ------------------------------------------------------------
-- Una publicación incompleta solo puede permanecer como:
-- draft, changes_requested, rejected o archived.
-- Al pasar a revisión o quedar visible, se exigen campos esenciales.
-- ------------------------------------------------------------
alter table public.dresses
  drop constraint if exists dresses_completa_antes_de_revision;

alter table public.dresses
  add constraint dresses_completa_antes_de_revision check (
    status in ('draft', 'changes_requested', 'rejected', 'archived')
    or (
      nullif(btrim(talla_etiqueta), '') is not null
      and silueta is not null
      and escote is not null
      and espalda is not null
      and manga is not null
      and tela_principal is not null
      and color_principal is not null
      and cola is not null
      and condicion is not null
      and precio_venta_mxn is not null
      and nullif(btrim(ciudad), '') is not null
      and nullif(btrim(estado), '') is not null
      and envio_nacional = true
      and (brand_id is not null or brand_suggestion_id is not null)
    )
  );

-- ------------------------------------------------------------
-- Trazabilidad de sugerencias de marca.
-- ------------------------------------------------------------
alter table public.brand_suggestions
  add column if not exists dress_id uuid
  references public.dresses(id) on delete set null;

create index if not exists idx_brand_suggestions_dress
  on public.brand_suggestions (dress_id);

-- Evita que una usuaria vincule una sugerencia ajena.
create or replace function public.enforce_brand_suggestion_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  suggestion_seller uuid;
begin
  if new.brand_suggestion_id is null then
    return new;
  end if;

  select bs.seller_id
  into suggestion_seller
  from public.brand_suggestions bs
  where bs.id = new.brand_suggestion_id;

  if suggestion_seller is null then
    raise exception 'La sugerencia de marca no existe';
  end if;

  if suggestion_seller <> new.seller_id
     and not (
       current_user in ('postgres', 'supabase_admin', 'service_role')
       or auth.role() = 'service_role'
       or public.is_admin()
     ) then
    raise exception 'La sugerencia de marca no pertenece a la vendedora';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_brand_suggestion_ownership() from public;

drop trigger if exists dresses_brand_suggestion_owner on public.dresses;
create trigger dresses_brand_suggestion_owner
  before insert or update of brand_suggestion_id, seller_id
  on public.dresses
  for each row
  execute function public.enforce_brand_suggestion_ownership();

-- Mantiene dress_id de la sugerencia sincronizado.
create or replace function public.sync_brand_suggestion_dress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.brand_suggestion_id is not null
     and old.brand_suggestion_id is distinct from new.brand_suggestion_id then
    update public.brand_suggestions
    set dress_id = null
    where id = old.brand_suggestion_id
      and dress_id = old.id;
  end if;

  if new.brand_suggestion_id is not null then
    update public.brand_suggestions
    set dress_id = new.id
    where id = new.brand_suggestion_id
      and seller_id = new.seller_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_brand_suggestion_dress() from public;

drop trigger if exists dresses_sync_brand_suggestion on public.dresses;
create trigger dresses_sync_brand_suggestion
  after insert or update of brand_suggestion_id
  on public.dresses
  for each row
  execute function public.sync_brand_suggestion_dress();

-- ------------------------------------------------------------
-- Borrado: solo borradores propios. El admin conserva su policy.
-- ------------------------------------------------------------
drop policy if exists "vendedora borra borrador propio" on public.dresses;
create policy "vendedora borra borrador propio"
  on public.dresses
  for delete
  to authenticated
  using (
    seller_id = auth.uid()
    and public.is_active_user()
    and status = 'draft'
  );

commit;
