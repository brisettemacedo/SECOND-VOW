-- SECOND VOW — 0032 · Corrección y fusión segura de marcas oficiales

create table if not exists public.brand_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_name text not null check (btrim(alias_name) <> ''),
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists brand_aliases_name_unique_ci
  on public.brand_aliases (lower(btrim(alias_name)));
create index if not exists brand_aliases_brand_id_idx
  on public.brand_aliases (brand_id);

create table if not exists public.brand_admin_history (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('rename', 'merge')),
  source_brand_id uuid references public.brands(id) on delete set null,
  target_brand_id uuid references public.brands(id) on delete set null,
  previous_name text not null,
  resulting_name text not null,
  affected_dresses integer not null default 0,
  reason text,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.brand_aliases enable row level security;
alter table public.brand_admin_history enable row level security;

revoke all on table public.brand_aliases from public, anon, authenticated;
revoke all on table public.brand_admin_history from public, anon, authenticated;
grant select on table public.brand_aliases to authenticated;
grant select on table public.brand_admin_history to authenticated;

drop policy if exists "admin reads brand aliases" on public.brand_aliases;
create policy "admin reads brand aliases" on public.brand_aliases
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admin reads brand history" on public.brand_admin_history;
create policy "admin reads brand history" on public.brand_admin_history
  for select to authenticated using ((select public.is_admin()));

create or replace function public.admin_manage_brand(
  p_source_brand_id uuid,
  p_action text,
  p_target_brand_id uuid default null,
  p_new_name text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.brands;
  v_target public.brands;
  v_affected integer := 0;
  v_new_name text;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_action not in ('rename', 'merge') then raise exception 'Acción inválida'; end if;

  select * into v_source from public.brands where id = p_source_brand_id for update;
  if not found then raise exception 'Marca origen inexistente'; end if;

  if p_action = 'rename' then
    v_new_name := btrim(coalesce(p_new_name, ''));
    if v_new_name = '' then raise exception 'Escribe el nombre correcto'; end if;
    if exists (
      select 1 from public.brands
      where id <> v_source.id and lower(btrim(name)) = lower(v_new_name)
    ) then
      raise exception 'Ese nombre ya existe; utiliza Fusionar';
    end if;

    update public.brands set name = v_new_name where id = v_source.id;
    insert into public.brand_aliases(alias_name, brand_id, created_by)
      values(v_source.name, v_source.id, auth.uid())
      on conflict (lower(btrim(alias_name))) do update set brand_id = excluded.brand_id;
    select count(*) into v_affected from public.dresses where brand_id = v_source.id;

    insert into public.brand_admin_history(action, source_brand_id, target_brand_id, previous_name, resulting_name, affected_dresses, reason, performed_by)
      values('rename', v_source.id, v_source.id, v_source.name, v_new_name, v_affected, nullif(btrim(p_reason), ''), auth.uid());

    return jsonb_build_object('action','rename','brand_id',v_source.id,'name',v_new_name,'affected_dresses',v_affected);
  end if;

  if p_target_brand_id is null or p_target_brand_id = v_source.id then
    raise exception 'Selecciona una marca destino diferente';
  end if;
  select * into v_target from public.brands where id = p_target_brand_id and is_active = true for update;
  if not found then raise exception 'Marca destino inexistente o inactiva'; end if;

  update public.dresses set brand_id = v_target.id where brand_id = v_source.id;
  get diagnostics v_affected = row_count;
  update public.brand_suggestions set resolved_brand_id = v_target.id where resolved_brand_id = v_source.id;
  update public.brand_aliases set brand_id = v_target.id where brand_id = v_source.id;
  insert into public.brand_aliases(alias_name, brand_id, created_by)
    values(v_source.name, v_target.id, auth.uid())
    on conflict (lower(btrim(alias_name))) do update set brand_id = excluded.brand_id;
  update public.brands set is_active = false where id = v_source.id;

  insert into public.brand_admin_history(action, source_brand_id, target_brand_id, previous_name, resulting_name, affected_dresses, reason, performed_by)
    values('merge', v_source.id, v_target.id, v_source.name, v_target.name, v_affected, nullif(btrim(p_reason), ''), auth.uid());

  return jsonb_build_object('action','merge','source_brand_id',v_source.id,'target_brand_id',v_target.id,'name',v_target.name,'affected_dresses',v_affected);
end;
$$;

revoke all on function public.admin_manage_brand(uuid,text,uuid,text,text) from public, anon;
grant execute on function public.admin_manage_brand(uuid,text,uuid,text,text) to authenticated;

-- Corrige el caso confirmado sin depender de identificadores generados.
do $$
declare
  v_source uuid;
  v_target uuid;
begin
  select id into v_source from public.brands where name = 'Susana Echaverria';
  select id into v_target from public.brands where name = 'Susana Echavarría';
  if v_source is not null and v_target is not null then
    update public.dresses set brand_id = v_target where brand_id = v_source;
    update public.brand_suggestions set resolved_brand_id = v_target where resolved_brand_id = v_source;
    update public.brand_aliases set brand_id = v_target where brand_id = v_source;
    insert into public.brand_aliases(alias_name, brand_id)
      values('Susana Echaverria', v_target)
      on conflict (lower(btrim(alias_name))) do update set brand_id = excluded.brand_id;
    update public.brands set is_active = false where id = v_source;
  end if;
end $$;
