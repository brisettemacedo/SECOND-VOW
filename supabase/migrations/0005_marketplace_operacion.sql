-- SECOND VOW 0005 — operación de marketplace (MVP)
begin;

alter table public.profiles add column if not exists identity_verified boolean not null default false;
alter table public.profiles add column if not exists response_time_minutes integer;
alter table public.profiles add column if not exists rating_average numeric(2,1);
alter table public.profiles add column if not exists rating_count integer not null default 0;

drop view if exists public.public_profiles;
create view public.public_profiles with (security_barrier=true) as
select id, identity_verified, response_time_minutes, rating_average from public.profiles where is_blocked=false;
revoke all on public.public_profiles from public; grant select on public.public_profiles to anon,authenticated;

create table if not exists public.conversations(
 id uuid primary key default gen_random_uuid(), dress_id uuid not null references public.dresses(id) on delete cascade,
 buyer_id uuid not null references public.profiles(id) on delete cascade, seller_id uuid not null references public.profiles(id) on delete cascade,
 last_message_at timestamptz not null default now(), created_at timestamptz not null default now(),
 constraint conversations_parties_different check(buyer_id<>seller_id), unique(dress_id,buyer_id,seller_id)
);
create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade, body text not null check(char_length(btrim(body)) between 1 and 2000),
 read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id,created_at);

create table if not exists public.offers(
 id uuid primary key default gen_random_uuid(), dress_id uuid not null references public.dresses(id) on delete cascade,
 buyer_id uuid not null references public.profiles(id), seller_id uuid not null references public.profiles(id), amount_mxn integer not null check(amount_mxn>0),
 status text not null default 'pending' check(status in('pending','accepted','rejected','cancelled','expired','countered')),
 expires_at timestamptz not null default(now()+interval '72 hours'), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists one_pending_offer_per_buyer_dress on public.offers(dress_id,buyer_id) where status='pending';

create table if not exists public.orders(
 id uuid primary key default gen_random_uuid(), dress_id uuid not null references public.dresses(id), offer_id uuid unique references public.offers(id),
 buyer_id uuid not null references public.profiles(id), seller_id uuid not null references public.profiles(id),
 subtotal_mxn integer not null, shipping_mxn integer not null default 0, commission_mxn integer not null default 0, total_mxn integer not null,
 seller_net_mxn integer not null, status text not null default 'awaiting_payment' check(status in('awaiting_payment','paid','shipped','delivered','completed','claim_open','return_authorized','return_shipped','returned','refunded','cancelled')),
 payment_provider text, payment_reference text, carrier text, tracking_number text,
 paid_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, claim_deadline_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.payments(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 provider text not null,provider_reference text,status text not null check(status in('pending','authorized','paid','failed','refunded','partially_refunded')),
 amount_mxn integer not null check(amount_mxn>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.claims(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 opened_by uuid not null references public.profiles(id),reason text not null,description text not null,
 status text not null default 'open' check(status in('open','under_review','approved_return','rejected','return_shipped','returned','refunded','closed')),
 return_tracking_number text,return_shipping_deadline_at timestamptz,resolved_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.ratings(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id),reviewee_id uuid not null references public.profiles(id),rating int not null check(rating between 1 and 5),
 created_at timestamptz not null default now(),unique(order_id,reviewer_id)
);
create table if not exists public.identity_verifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 legal_name text not null,document_path text not null,status text not null default 'pending' check(status in('pending','verified','rejected')),
 reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,rejection_reason text,created_at timestamptz not null default now()
);

insert into storage.buckets(id,name,public) values('identity-documents','identity-documents',false) on conflict(id) do update set public=false;

create or replace function public.get_or_create_conversation(p_dress_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_buyer uuid:=auth.uid();v_seller uuid;v_id uuid;
begin if v_buyer is null then raise exception 'Debes iniciar sesión';end if;
 select seller_id into v_seller from public.dresses where id=p_dress_id and status in('approved','reserved');
 if v_seller is null then raise exception 'Vestido no disponible';end if;if v_seller=v_buyer then raise exception 'No puedes contactarte a ti misma';end if;
 insert into public.conversations(dress_id,buyer_id,seller_id) values(p_dress_id,v_buyer,v_seller)
 on conflict(dress_id,buyer_id,seller_id) do update set last_message_at=public.conversations.last_message_at returning id into v_id;return v_id;end$$;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

create or replace function public.touch_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.conversations set last_message_at=new.created_at where id=new.conversation_id;return new;end$$;
drop trigger if exists messages_touch_conversation on public.messages;create trigger messages_touch_conversation after insert on public.messages for each row execute function public.touch_conversation();

create or replace function public.accept_offer(p_offer_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.offers;v_order uuid;v_commission integer;
begin select * into o from public.offers where id=p_offer_id for update;if o.id is null then raise exception 'Oferta inexistente';end if;
 if o.seller_id<>auth.uid() and not public.is_admin() then raise exception 'No autorizado';end if;if o.status<>'pending' or o.expires_at<now() then raise exception 'Oferta no disponible';end if;
 v_commission:=round(o.amount_mxn*.05);update public.offers set status='accepted',updated_at=now() where id=o.id;
 update public.offers set status='rejected',updated_at=now() where dress_id=o.dress_id and id<>o.id and status='pending';
 update public.dresses set status='reserved' where id=o.dress_id;
 insert into public.orders(dress_id,offer_id,buyer_id,seller_id,subtotal_mxn,commission_mxn,total_mxn,seller_net_mxn)
 values(o.dress_id,o.id,o.buyer_id,o.seller_id,o.amount_mxn,v_commission,o.amount_mxn,o.amount_mxn-v_commission) returning id into v_order;return v_order;end$$;
grant execute on function public.accept_offer(uuid) to authenticated;

create or replace function public.refresh_rating(p_user uuid) returns void language sql security definer set search_path='' as $$
 update public.profiles p set rating_average=s.avg_rating,rating_count=s.cnt from(select reviewee_id,round(avg(rating)::numeric,1) avg_rating,count(*)::int cnt from public.ratings where reviewee_id=p_user group by reviewee_id)s where p.id=s.reviewee_id$$;
create or replace function public.after_rating() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.refresh_rating(new.reviewee_id);return new;end$$;
drop trigger if exists ratings_refresh_profile on public.ratings;create trigger ratings_refresh_profile after insert or update on public.ratings for each row execute function public.after_rating();

create or replace function public.admin_resolve_identity_verification(p_verification_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid;begin if not public.is_admin() then raise exception 'No autorizado';end if;if p_status not in('verified','rejected') then raise exception 'Estado inválido';end if;
 update public.identity_verifications set status=p_status,reviewed_by=auth.uid(),reviewed_at=now() where id=p_verification_id returning user_id into v_user;
 if p_status='verified' then update public.profiles set identity_verified=true where id=v_user;end if;end$$;
grant execute on function public.admin_resolve_identity_verification(uuid,text) to authenticated;


-- Protecciones de transición: la UI no es una barrera de seguridad.
create or replace function public.enforce_offer_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if public.is_admin() then return new; end if;
  if old.status <> 'pending' then raise exception 'La oferta ya no puede modificarse'; end if;
  if auth.uid() = old.buyer_id then
    if new.status <> 'cancelled' then raise exception 'La compradora solo puede cancelar su oferta'; end if;
  elsif auth.uid() = old.seller_id then
    if new.status not in ('rejected','countered') then raise exception 'Usa la función de aceptación para aceptar una oferta'; end if;
  else raise exception 'No autorizado'; end if;
  if new.dress_id<>old.dress_id or new.buyer_id<>old.buyer_id or new.seller_id<>old.seller_id or new.amount_mxn<>old.amount_mxn then raise exception 'No se pueden alterar los datos esenciales de la oferta'; end if;
  new.updated_at:=now(); return new;
end$$;
drop trigger if exists offers_enforce_update on public.offers;create trigger offers_enforce_update before update on public.offers for each row execute function public.enforce_offer_update();

create or replace function public.enforce_order_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if public.is_admin() or auth.role()='service_role' then new.updated_at:=now();return new;end if;
  if auth.uid()=old.seller_id then
    if not(old.status='paid' and new.status='shipped' and nullif(btrim(new.tracking_number),'') is not null and nullif(btrim(new.carrier),'') is not null) then raise exception 'Transición de pedido no permitida para la vendedora';end if;
  elsif auth.uid()=old.buyer_id then
    if not(old.status='shipped' and new.status='delivered') then raise exception 'Transición de pedido no permitida para la compradora';end if;
    new.delivered_at:=coalesce(new.delivered_at,now());new.claim_deadline_at:=coalesce(new.claim_deadline_at,now()+interval '60 days');
  else raise exception 'No autorizado';end if;
  if new.buyer_id<>old.buyer_id or new.seller_id<>old.seller_id or new.dress_id<>old.dress_id or new.subtotal_mxn<>old.subtotal_mxn or new.commission_mxn<>old.commission_mxn or new.total_mxn<>old.total_mxn or new.seller_net_mxn<>old.seller_net_mxn then raise exception 'No se pueden alterar importes o participantes';end if;
  new.updated_at:=now();return new;
end$$;
drop trigger if exists orders_enforce_update on public.orders;create trigger orders_enforce_update before update on public.orders for each row execute function public.enforce_order_update();

alter table public.conversations enable row level security;alter table public.messages enable row level security;alter table public.offers enable row level security;alter table public.orders enable row level security;alter table public.payments enable row level security;alter table public.claims enable row level security;alter table public.ratings enable row level security;alter table public.identity_verifications enable row level security;

-- conversations/messages
create policy "participants read conversations" on public.conversations for select to authenticated using(auth.uid() in(buyer_id,seller_id) or public.is_admin());
create policy "participants read messages" on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and(auth.uid() in(c.buyer_id,c.seller_id) or public.is_admin())));
create policy "participants send messages" on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.buyer_id,c.seller_id)));
create policy "recipient marks read" on public.messages for update to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.buyer_id,c.seller_id))) with check(exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.buyer_id,c.seller_id)));
-- offers
create policy "parties read offers" on public.offers for select to authenticated using(auth.uid() in(buyer_id,seller_id) or public.is_admin());
create policy "buyer creates offer" on public.offers for insert to authenticated with check(buyer_id=auth.uid() and buyer_id<>seller_id and status='pending' and exists(select 1 from public.dresses d where d.id=dress_id and d.seller_id=seller_id and d.status='approved'));
create policy "parties update offers" on public.offers for update to authenticated using(auth.uid() in(buyer_id,seller_id) or public.is_admin()) with check(auth.uid() in(buyer_id,seller_id) or public.is_admin());
-- orders
create policy "parties read orders" on public.orders for select to authenticated using(auth.uid() in(buyer_id,seller_id) or public.is_admin());
create policy "parties update orders" on public.orders for update to authenticated using(auth.uid() in(buyer_id,seller_id) or public.is_admin()) with check(auth.uid() in(buyer_id,seller_id) or public.is_admin());
create policy "parties read payments" on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())));
-- claims
create policy "parties read claims" on public.claims for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and(auth.uid() in(o.buyer_id,o.seller_id) or public.is_admin())));
create policy "buyer opens claim" on public.claims for insert to authenticated with check(opened_by=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid() and o.delivered_at is not null and now()<=coalesce(o.claim_deadline_at,o.delivered_at+interval '60 days')));
create policy "admin updates claims" on public.claims for update to authenticated using(public.is_admin()) with check(public.is_admin());
-- ratings
create policy "public ratings aggregate only" on public.ratings for select to authenticated using(reviewer_id=auth.uid() or reviewee_id=auth.uid() or public.is_admin());
create policy "party rates completed order" on public.ratings for insert to authenticated with check(reviewer_id=auth.uid() and reviewer_id<>reviewee_id and exists(select 1 from public.orders o where o.id=order_id and o.status='completed' and auth.uid() in(o.buyer_id,o.seller_id) and reviewee_id in(o.buyer_id,o.seller_id)));
-- identity
create policy "user reads verification" on public.identity_verifications for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "user submits verification" on public.identity_verifications for insert to authenticated with check(user_id=auth.uid() and status='pending');
create policy "admin updates verification" on public.identity_verifications for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "identity upload own folder" on storage.objects for insert to authenticated with check(bucket_id='identity-documents' and(storage.foldername(name))[1]=auth.uid()::text);
create policy "identity read own or admin" on storage.objects for select to authenticated using(bucket_id='identity-documents' and((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

revoke all on public.conversations,public.messages,public.offers,public.orders,public.payments,public.claims,public.ratings,public.identity_verifications from anon,authenticated;
grant select on public.conversations,public.messages,public.offers,public.orders,public.payments,public.claims,public.ratings,public.identity_verifications to authenticated;
grant insert on public.messages,public.offers,public.claims,public.ratings,public.identity_verifications to authenticated;
grant update(read_at) on public.messages to authenticated;
grant update(status) on public.offers to authenticated;
grant update(status,carrier,tracking_number,shipped_at,delivered_at,claim_deadline_at) on public.orders to authenticated;
grant update(status,resolved_at,return_shipping_deadline_at,return_tracking_number) on public.claims to authenticated;
grant update(status,reviewed_by,reviewed_at,rejection_reason) on public.identity_verifications to authenticated;
commit;
