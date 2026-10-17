begin;

-- Count people, not messages, using the per-user read cursor already maintained
-- by mark_conversation_read. Explicit participation also scopes administrator inboxes.
create or replace function public.count_unread_message_people()
returns integer language sql stable security invoker set search_path='' as $$
  select count(distinct m.sender_id)::integer
  from public.messages m
  join public.conversations c on c.id=m.conversation_id
  left join public.conversation_participant_state s on s.conversation_id=c.id and s.user_id=(select auth.uid())
  where (select auth.uid()) is not null
    and ((select auth.uid())=c.buyer_id or (select auth.uid())=c.seller_id)
    and m.sender_id<>(select auth.uid())
    and case when s.last_read_at is not null then m.created_at>s.last_read_at else m.read_at is null end;
$$;
revoke all on function public.count_unread_message_people() from public,anon;
grant execute on function public.count_unread_message_people() to authenticated;

-- Historical accepted offers on cancelled/refunded operations do not constitute
-- an open sale. The order guard is authoritative and runs while holding the dress lock.
create or replace function public.remove_own_dress_listing(p_dress_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare d public.dresses;
begin
  if (select auth.uid()) is null then raise exception 'No autorizado'; end if;
  select * into d from public.dresses where id=p_dress_id for update;
  if d.id is null or d.seller_id<>(select auth.uid()) then raise exception 'No autorizado'; end if;
  if d.status in ('reserved','sold')
    or exists(select 1 from public.orders o where o.dress_id=d.id and o.status not in('cancelled','refunded','completed')) then
    raise exception 'No puedes eliminar esta publicación mientras exista una venta abierta';
  end if;
  update public.offers set status='cancelled',updated_at=now() where dress_id=d.id and status='pending';
  update public.dresses set status='archived',removed_by_seller_at=now(),updated_at=now() where id=d.id;
  return 'removed';
end $$;
revoke all on function public.remove_own_dress_listing(uuid) from public,anon;
grant execute on function public.remove_own_dress_listing(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
