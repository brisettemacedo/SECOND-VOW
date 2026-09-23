-- Public data is copied into deliberately small, RLS-protected read models.
-- This lets the public views use SECURITY INVOKER without exposing private
-- columns from profiles, ratings or orders.
begin;

-- Keep the materialized read models outside the exposed `public` schema.
-- `anon`/`authenticated` need SELECT only so the SECURITY INVOKER views can
-- read them, but PostgREST cannot expose the underlying tables as endpoints.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

create table if not exists private.public_profile_cards (
  id uuid primary key references public.profiles(id) on delete cascade,
  identity_verified boolean not null default false,
  response_time_minutes integer,
  rating_average numeric,
  rating_count integer not null default 0,
  completed_sales_count integer not null default 0,
  display_name text,
  updated_at timestamptz not null default now()
);

alter table private.public_profile_cards enable row level security;
drop policy if exists "public reads profile cards" on private.public_profile_cards;
create policy "public reads profile cards"
  on private.public_profile_cards for select
  to anon, authenticated
  using (true);
revoke all on private.public_profile_cards from public, anon, authenticated;
grant select on private.public_profile_cards to anon, authenticated;
grant all on private.public_profile_cards to service_role;

create table if not exists private.public_seller_review_cards (
  id uuid primary key references public.ratings(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table private.public_seller_review_cards enable row level security;
drop policy if exists "public reads seller review cards" on private.public_seller_review_cards;
create policy "public reads seller review cards"
  on private.public_seller_review_cards for select
  to anon, authenticated
  using (true);
revoke all on private.public_seller_review_cards from public, anon, authenticated;
grant select on private.public_seller_review_cards to anon, authenticated;
grant all on private.public_seller_review_cards to service_role;

create or replace function public.sync_public_profile_card(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.public_profile_cards (
    id, identity_verified, response_time_minutes, rating_average,
    rating_count, completed_sales_count, display_name, updated_at
  )
  select
    p.id,
    p.identity_verified,
    p.response_time_minutes,
    p.rating_average,
    p.rating_count,
    (select count(*)::integer from public.orders o where o.seller_id = p.id and o.status = 'completed'),
    case
      when nullif(btrim(p.full_name), '') is null
        or p.full_name like '%@%'
        or p.full_name ~* '^https?://'
      then null
      else btrim(p.full_name)
    end,
    now()
  from public.profiles p
  where p.id = p_profile_id
    and p.is_blocked = false
  on conflict (id) do update set
    identity_verified = excluded.identity_verified,
    response_time_minutes = excluded.response_time_minutes,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    completed_sales_count = excluded.completed_sales_count,
    display_name = excluded.display_name,
    updated_at = now();

  if not found then
    delete from private.public_profile_cards where id = p_profile_id;
  end if;
end;
$$;

create or replace function public.sync_public_profile_card_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_public_profile_card(old.id);
    return old;
  end if;
  perform public.sync_public_profile_card(new.id);
  return new;
end;
$$;

create or replace function public.sync_public_profile_card_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_public_profile_card(old.seller_id);
    return old;
  end if;
  perform public.sync_public_profile_card(new.seller_id);
  if tg_op = 'UPDATE' and old.seller_id is distinct from new.seller_id then
    perform public.sync_public_profile_card(old.seller_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_public_profile_card_profile on public.profiles;
create trigger sync_public_profile_card_profile
after insert or update of full_name, identity_verified, response_time_minutes,
  rating_average, rating_count, is_blocked
on public.profiles for each row
execute function public.sync_public_profile_card_from_profile();

drop trigger if exists sync_public_profile_card_order on public.orders;
create trigger sync_public_profile_card_order
after insert or delete or update of status, seller_id
on public.orders for each row
execute function public.sync_public_profile_card_from_order();

create or replace function public.sync_public_seller_review_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rating public.ratings;
begin
  if tg_op = 'DELETE' then
    delete from private.public_seller_review_cards where id = old.id;
    return old;
  end if;

  v_rating := new;
  if exists (
    select 1
    from public.orders o
    where o.id = v_rating.order_id
      and o.status = 'completed'
      and v_rating.reviewer_id = o.buyer_id
      and v_rating.reviewee_id = o.seller_id
  ) then
    insert into private.public_seller_review_cards (
      id, reviewee_id, rating, comment, created_at, updated_at
    ) values (
      v_rating.id, v_rating.reviewee_id, v_rating.rating,
      v_rating.comment, v_rating.created_at, now()
    )
    on conflict (id) do update set
      reviewee_id = excluded.reviewee_id,
      rating = excluded.rating,
      comment = excluded.comment,
      created_at = excluded.created_at,
      updated_at = now();
  else
    delete from private.public_seller_review_cards where id = v_rating.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_public_seller_review_card_rating on public.ratings;
create trigger sync_public_seller_review_card_rating
after insert or update or delete on public.ratings
for each row execute function public.sync_public_seller_review_card();

insert into private.public_profile_cards (
  id, identity_verified, response_time_minutes, rating_average,
  rating_count, completed_sales_count, display_name
)
select
  p.id, p.identity_verified, p.response_time_minutes, p.rating_average, p.rating_count,
  (select count(*)::integer from public.orders o where o.seller_id = p.id and o.status = 'completed'),
  case
    when nullif(btrim(p.full_name), '') is null
      or p.full_name like '%@%'
      or p.full_name ~* '^https?://'
    then null
    else btrim(p.full_name)
  end
from public.profiles p
where p.is_blocked = false
on conflict (id) do update set
  identity_verified = excluded.identity_verified,
  response_time_minutes = excluded.response_time_minutes,
  rating_average = excluded.rating_average,
  rating_count = excluded.rating_count,
  completed_sales_count = excluded.completed_sales_count,
  display_name = excluded.display_name,
  updated_at = now();

insert into private.public_seller_review_cards (id, reviewee_id, rating, comment, created_at)
select r.id, r.reviewee_id, r.rating, r.comment, r.created_at
from public.ratings r
join public.orders o on o.id = r.order_id
where o.status = 'completed'
  and r.reviewer_id = o.buyer_id
  and r.reviewee_id = o.seller_id
on conflict (id) do update set
  reviewee_id = excluded.reviewee_id,
  rating = excluded.rating,
  comment = excluded.comment,
  created_at = excluded.created_at,
  updated_at = now();

drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = true, security_barrier = true) as
select id, identity_verified, response_time_minutes, rating_average,
  rating_count, completed_sales_count, display_name
from private.public_profile_cards;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

drop view if exists public.public_seller_reviews;
create view public.public_seller_reviews
with (security_invoker = true, security_barrier = true) as
select id, reviewee_id, rating, comment, created_at
from private.public_seller_review_cards;
revoke all on public.public_seller_reviews from public, anon, authenticated;
grant select on public.public_seller_reviews to anon, authenticated;

-- The public catalog must not need to execute is_admin(). Separate anonymous
-- policies from authenticated policies before removing anonymous function access.
do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and 'anon' = any(roles)
      and coalesce(qual, '') like '%is_admin%'
      and tablename <> 'dresses'
  loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
    execute format('drop policy if exists "anonymous catalog read" on public.%I', r.tablename);
    execute format('create policy "anonymous catalog read" on public.%I for select to anon using (is_active = true)', r.tablename);
  end loop;
end;
$$;

alter policy "ver vestidos aprobados propios o admin" on public.dresses to authenticated;
drop policy if exists "anonymous reads published dresses" on public.dresses;
create policy "anonymous reads published dresses"
  on public.dresses for select to anon
  using (status in ('approved','reserved','sold'));

-- Start from zero implicit EXECUTE privileges for every privileged public
-- function, then grant only the audited call paths.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', r.signature);
  end loop;
end;
$$;

-- Server-only functions.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname like 'backend\_%' escape '\'
  loop
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end;
$$;

-- Admin RPCs all contain an is_admin() guard; authenticated is needed so a
-- signed-in administrator can invoke them through PostgREST.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname like 'admin\_%' escape '\'
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.signature);
  end loop;
end;
$$;

-- User-facing RPCs: each one validates auth.uid(), ownership/participation,
-- or performs bounded expiry/reminder maintenance.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname = any(array[
        'accept_offer','accept_order_checkout_terms_v2','accept_order_condition',
        'acknowledge_id_delivery','appeal_claim_resolution','cancel_offer',
        'confirm_order_delivered','confirm_return_received','create_offer',
        'decline_offer','delete_own_dress_photo',
        'get_or_create_conversation','mark_conversation_read','mark_order_shipped',
        'open_order_claim','refresh_my_offer_reminders','register_return_shipment',
        'remove_own_dress_listing','request_seller_payout','seller_provide_return_label',
        'seller_request_order_cancellation','seller_respond_to_claim',
        'set_conversation_shipping_destination','set_order_shipping_quote',
        'set_own_dress_primary_photo','submit_dress_for_review'
      ])
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.signature);
  end loop;
end;
$$;

-- RLS helper functions. They are intentionally privileged to avoid recursive
-- policies, but only signed-in users may execute them.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname = any(array[
        'are_users_blocked','dress_has_active_order','dress_has_any_order',
        'is_active_user','is_admin','is_conversation_participant'
      ])
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.signature);
  end loop;
end;
$$;

-- Expiry maintenance is server-only. Public dress and message pages call these
-- through the server client, never with anonymous/authenticated database roles.
grant execute on function public.expire_dress_reservation_if_stale(uuid) to service_role;
grant execute on function public.expire_stale_offers() to service_role;

notify pgrst, 'reload schema';
commit;
