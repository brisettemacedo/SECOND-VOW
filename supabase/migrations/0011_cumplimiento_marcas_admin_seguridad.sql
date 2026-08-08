-- ============================================================
-- SECOND VOW — 0011 · Cumplimiento, marcas, administración y seguridad
-- REQUIERE 0001–0010 ya aplicadas. NO sustituye ni reescribe migraciones anteriores.
-- ============================================================
begin;

-- ------------------------------------------------------------
-- 1. Sugerencias de marca: resolución administrativa trazable
-- ------------------------------------------------------------
alter table public.brand_suggestions
  add column if not exists resolved_brand_id uuid references public.brands(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

create index if not exists idx_brand_suggestions_pending
  on public.brand_suggestions (status, created_at desc);

create or replace function public.admin_resolve_brand_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_existing_brand_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.brand_suggestions;
  v_brand_id uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_action not in ('approve_new','link_existing','reject') then raise exception 'Acción inválida'; end if;
  select * into v_s from public.brand_suggestions where id=p_suggestion_id for update;
  if v_s.id is null then raise exception 'Sugerencia inexistente'; end if;

  if p_action='reject' then
    update public.brand_suggestions set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), review_notes=p_notes, resolved_brand_id=null where id=v_s.id;
    return null;
  end if;

  if p_action='link_existing' then
    if p_existing_brand_id is null or not exists(select 1 from public.brands b where b.id=p_existing_brand_id) then raise exception 'Marca destino inválida'; end if;
    v_brand_id:=p_existing_brand_id;
  else
    select b.id into v_brand_id from public.brands b where lower(btrim(b.name))=lower(btrim(v_s.suggested_name)) limit 1;
    if v_brand_id is null then
      insert into public.brands(name,is_active) values(btrim(v_s.suggested_name),true) returning id into v_brand_id;
    end if;
  end if;

  update public.brand_suggestions
    set status='approved', resolved_brand_id=v_brand_id, reviewed_by=auth.uid(), reviewed_at=now(), review_notes=p_notes
    where id=v_s.id;
  update public.dresses set brand_id=v_brand_id, brand_suggestion_id=null where brand_suggestion_id=v_s.id;
  return v_brand_id;
end;
$$;
revoke all on function public.admin_resolve_brand_suggestion(uuid,text,uuid,text) from public;
grant execute on function public.admin_resolve_brand_suggestion(uuid,text,uuid,text) to authenticated;

-- ------------------------------------------------------------
-- 2. Evidencia de aceptación legal
-- ------------------------------------------------------------
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check(document_type in ('privacy','terms','data_processing')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup',
  user_agent text,
  unique(user_id,document_type,document_version)
);
alter table public.legal_acceptances enable row level security;
drop policy if exists "user reads own legal acceptances" on public.legal_acceptances;
create policy "user reads own legal acceptances" on public.legal_acceptances for select to authenticated using(user_id=auth.uid() or public.is_admin());
revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;

-- Actualiza el trigger de altas para dejar constancia de las aceptaciones recibidas desde la UI.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_at timestamptz;
begin
  insert into public.profiles(id,full_name)
  values(new.id,nullif(btrim(new.raw_user_meta_data ->> 'full_name'),''))
  on conflict(id) do nothing;
  begin v_at := coalesce((new.raw_user_meta_data ->> 'legal_accepted_at')::timestamptz, now()); exception when others then v_at:=now(); end;
  if coalesce((new.raw_user_meta_data ->> 'privacy_accepted')::boolean,false) then
    insert into public.legal_acceptances(user_id,document_type,document_version,accepted_at)
    values(new.id,'privacy',coalesce(new.raw_user_meta_data ->> 'privacy_version','unknown'),v_at) on conflict do nothing;
  end if;
  if coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean,false) then
    insert into public.legal_acceptances(user_id,document_type,document_version,accepted_at)
    values(new.id,'terms',coalesce(new.raw_user_meta_data ->> 'terms_version','unknown'),v_at) on conflict do nothing;
  end if;
  if coalesce((new.raw_user_meta_data ->> 'data_processing_accepted')::boolean,false) then
    insert into public.legal_acceptances(user_id,document_type,document_version,accepted_at)
    values(new.id,'data_processing',coalesce(new.raw_user_meta_data ->> 'privacy_version','unknown'),v_at) on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. Declaraciones de la vendedora por publicación
-- ------------------------------------------------------------
create table if not exists public.dress_declarations (
  dress_id uuid primary key references public.dresses(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  authenticity_declared boolean not null,
  photos_correspond_declared boolean not null,
  right_to_sell_declared boolean not null,
  information_true_declared boolean not null,
  terms_version text not null,
  declared_at timestamptz not null default now()
);
alter table public.dress_declarations enable row level security;
drop policy if exists "seller reads own dress declaration" on public.dress_declarations;
create policy "seller reads own dress declaration" on public.dress_declarations for select to authenticated using(seller_id=auth.uid() or public.is_admin());
drop policy if exists "seller creates own dress declaration" on public.dress_declarations;
create policy "seller creates own dress declaration" on public.dress_declarations for insert to authenticated with check(
  seller_id=auth.uid() and exists(select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid())
);
drop policy if exists "seller updates own draft declaration" on public.dress_declarations;
create policy "seller updates own draft declaration" on public.dress_declarations for update to authenticated using(
  seller_id=auth.uid() and exists(select 1 from public.dresses d where d.id=dress_id and d.seller_id=auth.uid() and d.status in ('draft','changes_requested'))
) with check(seller_id=auth.uid());
revoke all on public.dress_declarations from anon, authenticated;
grant select,insert,update on public.dress_declarations to authenticated;

create or replace function public.require_declarations_before_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='pending_review' and old.status is distinct from 'pending_review' then
    if not exists(
      select 1 from public.dress_declarations x where x.dress_id=new.id and x.seller_id=new.seller_id
        and x.authenticity_declared and x.photos_correspond_declared and x.right_to_sell_declared and x.information_true_declared
    ) then raise exception 'Debes aceptar las declaraciones de publicación antes de enviar a revisión'; end if;
    if new.brand_suggestion_id is not null and exists(select 1 from public.brand_suggestions bs where bs.id=new.brand_suggestion_id and bs.status='rejected') then
      raise exception 'La marca sugerida fue rechazada. Selecciona o sugiere otra marca';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists dresses_require_declarations on public.dresses;
create trigger dresses_require_declarations before update of status on public.dresses for each row execute function public.require_declarations_before_review();

-- ------------------------------------------------------------
-- 4. Solicitudes ARCO / privacidad
-- ------------------------------------------------------------
create table if not exists public.arco_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check(request_type in ('access','rectification','cancellation','opposition','revocation','limitation')),
  description text not null check(length(btrim(description)) between 10 and 5000),
  status text not null default 'received' check(status in ('received','in_review','needs_information','resolved','rejected')),
  admin_response text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.arco_requests enable row level security;
drop policy if exists "user creates arco request" on public.arco_requests;
create policy "user creates arco request" on public.arco_requests for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "user reads own arco request" on public.arco_requests;
create policy "user reads own arco request" on public.arco_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "admin updates arco requests" on public.arco_requests;
create policy "admin updates arco requests" on public.arco_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.arco_requests from anon,authenticated;
grant select,insert,update on public.arco_requests to authenticated;

-- ------------------------------------------------------------
-- 5. Verificación de identidad: minimización y borrado del documento
-- ------------------------------------------------------------
alter table public.identity_verifications
  add column if not exists document_type text,
  add column if not exists verification_result text,
  add column if not exists document_deleted_at timestamptz,
  add column if not exists provider text not null default 'secondvow_manual',
  add column if not exists provider_reference text;
alter table public.identity_verifications alter column legal_name drop not null;
alter table public.identity_verifications alter column document_path drop not null;

create or replace function public.admin_resolve_identity_verification(p_verification_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_path text;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in('verified','rejected') then raise exception 'Estado inválido'; end if;
  select user_id,document_path into v_user,v_path from public.identity_verifications where id=p_verification_id for update;
  if v_user is null then raise exception 'Verificación inexistente'; end if;
  if v_path is not null then delete from storage.objects where bucket_id='identity-documents' and name=v_path; end if;
  update public.identity_verifications set
    status=p_status, verification_result=p_status, reviewed_by=auth.uid(), reviewed_at=now(),
    document_deleted_at=case when v_path is not null then now() else document_deleted_at end,
    document_path=null, legal_name=null
  where id=p_verification_id;
  update public.profiles set identity_verified=(p_status='verified') where id=v_user;
end;
$$;
revoke all on function public.admin_resolve_identity_verification(uuid,text) from public;
grant execute on function public.admin_resolve_identity_verification(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- 6. Administración de bloqueos
-- ------------------------------------------------------------
create or replace function public.admin_set_user_blocked(p_user_id uuid,p_blocked boolean,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_user_id=auth.uid() and p_blocked then raise exception 'No puedes bloquear tu propia cuenta administradora'; end if;
  update public.profiles set is_blocked=p_blocked, blocked_reason=case when p_blocked then nullif(btrim(p_reason),'') else null end, blocked_at=case when p_blocked then now() else null end where id=p_user_id;
end;
$$;
revoke all on function public.admin_set_user_blocked(uuid,boolean,text) from public;
grant execute on function public.admin_set_user_blocked(uuid,boolean,text) to authenticated;

commit;
