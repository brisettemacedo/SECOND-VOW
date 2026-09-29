-- Keep past conversations readable, but stop new messages after a dress is sold.
begin;

create or replace function public.reject_messages_after_sale()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.conversations c
    join public.dresses d on d.id = c.dress_id
    where c.id = new.conversation_id
      and d.status = 'sold'
      and not exists (
        select 1 from public.orders o
        where o.dress_id = c.dress_id
          and o.buyer_id = c.buyer_id
          and o.seller_id = c.seller_id
          and o.status in ('paid', 'preparing_shipment', 'shipped', 'inspection', 'delivered', 'approved_return', 'return_shipped', 'refund_pending')
      )
  ) then
    raise exception using errcode = 'P0001', message = 'Esta venta terminó. El chat queda disponible como historial.';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_messages_after_sale() from public, anon, authenticated;

drop trigger if exists messages_close_after_sale on public.messages;
create trigger messages_close_after_sale
before insert on public.messages
for each row execute function public.reject_messages_after_sale();

commit;
