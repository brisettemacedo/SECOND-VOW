-- Corrige el guard heredado de 0005. Las reglas antiguas estaban invertidas:
-- impedían que la compradora aceptara/rechazara y que la vendedora cancelara.
create or replace function public.enforce_offer_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'La oferta ya no puede modificarse';
  end if;

  if (select auth.uid()) = old.buyer_id then
    if new.status not in ('accepted', 'rejected') then
      raise exception 'La compradora solo puede aceptar o rechazar esta oferta';
    end if;
  elsif (select auth.uid()) = old.seller_id then
    if new.status not in ('cancelled', 'countered') then
      raise exception 'La vendedora solo puede cancelar o reemplazar esta oferta';
    end if;
  else
    raise exception 'No autorizado';
  end if;

  if new.dress_id is distinct from old.dress_id
     or new.conversation_id is distinct from old.conversation_id
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.amount_mxn is distinct from old.amount_mxn
     or new.shipping_mxn is distinct from old.shipping_mxn
     or new.expires_at is distinct from old.expires_at then
    raise exception 'No se pueden alterar los datos esenciales de la oferta';
  end if;

  new.updated_at := now();
  return new;
end
$function$;

revoke all on function public.enforce_offer_update() from public;

