-- SECOND VOW 0044: moderación de contenido y prevención de operaciones externas.
begin;

create or replace function public.has_disallowed_contact_content(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text;
  v_compact text;
begin
  if nullif(btrim(p_text), '') is null then return false; end if;

  v_text := lower(translate(p_text, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
  -- Los enlaces internos se permiten; cualquier otro dominio se bloquea.
  v_text := regexp_replace(
    v_text,
    '(https?://)?(www\.)?second-vow\.com(/[[:alnum:]_?&=%#./~-]*)?',
    ' ',
    'gi'
  );
  v_compact := regexp_replace(v_text, '[^a-z0-9@.]', '', 'g');

  return
    v_text ~* '(https?://|www\.)[^[:space:]]+'
    or v_text ~* '\m[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.[a-z]{2,}(/[[:alnum:]_?&=%#./~-]*)?\M'
    or v_text ~* '\m[a-z0-9._%+-]+[[:space:]]*@[[:space:]]*[a-z0-9.-]+[[:space:]]*\.[[:space:]]*[a-z]{2,}\M'
    or v_text ~* '\m(gmail|hotmail|outlook|yahoo|icloud)\M'
    or v_text ~* '\m(arroba|punto[[:space:]]+(com|mx|net|org))\M'
    or v_text ~* '(^|[[:space:]])@[a-z0-9._-]{2,}'
    or v_text ~* '(\+?[0-9][[:space:]().-]*){10,}'
    or v_text ~* '\m(whats(app)?|wsp|telegram|instagram|facebook|messenger|tiktok|signal|snapchat|wechat)\M'
    or v_text ~* 'w[[:space:]_.-]*h[[:space:]_.-]*a[[:space:]_.-]*t[[:space:]_.-]*s[[:space:]_.-]*a[[:space:]_.-]*p[[:space:]_.-]*p'
    or position('wa.me' in v_compact) > 0
    or v_text ~* '\m(clabe|transferencia|deposito|paypal)\M'
    or v_text ~* '\m(cuenta[[:space:]]+bancaria|mercado[[:space:]]*pago|western[[:space:]]*union)\M'
    or v_text ~* '\m(trato|pago|venta|compra|operacion|negociacion)[[:space:]]+(por[[:space:]]+)?fuera\M'
    or v_text ~* '\mfuera[[:space:]]+de[[:space:]]+(second[[:space:]]*vow|la[[:space:]]+plataforma)\M'
    or v_text ~* '\m(evitar|ahorrar|saltar|sin)[[:space:]]+(la[[:space:]]+)?comision\M'
    or v_text ~* '\m(escribe(me)?|contacta(me)?|llama(me)?|manda(me)?|habla(me)?)[[:space:]]+(por|al)\M';
end;
$$;

revoke all on function public.has_disallowed_contact_content(text) from public, anon, authenticated;

create or replace function public.enforce_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_block_message constant text := E'No pudimos enviar este mensaje porque parece contener datos de contacto, enlaces o una invitación para continuar la operación fuera de SECOND VOW.\n\nPor seguridad, mantén la conversación, la oferta y el pago dentro de la plataforma.';
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;

  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null then raise exception 'Conversación inexistente'; end if;
  if new.sender_id <> auth.uid() then raise exception 'No puedes enviar mensajes como otra usuaria'; end if;
  if auth.uid() not in (c.buyer_id, c.seller_id) then raise exception 'No perteneces a esta conversación'; end if;
  if c.status <> 'active' then raise exception 'La conversación no está activa'; end if;
  if public.are_users_blocked(c.buyer_id, c.seller_id) then raise exception 'La conversación está bloqueada'; end if;
  if not public.is_active_user() then raise exception 'La cuenta no puede enviar mensajes'; end if;

  if new.message_type = 'text' and public.has_disallowed_contact_content(new.body) then
    raise exception using errcode = 'P0001', message = v_block_message;
  end if;
  if new.message_type = 'text' and exists (
    select 1 from public.messages m
    where m.conversation_id = new.conversation_id
      and m.sender_id = new.sender_id
      and lower(btrim(m.body)) = lower(btrim(new.body))
      and m.created_at > now() - interval '5 minutes'
  ) then
    raise exception using errcode = 'P0001', message = v_block_message;
  end if;
  if (select count(*) from public.messages m where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 10 then
    raise exception using errcode = 'P0001', message = v_block_message;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_message_insert() from public, anon, authenticated;

create or replace function public.enforce_safe_optional_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text;
  v_block_message constant text := E'No pudimos enviar este mensaje porque parece contener datos de contacto, enlaces o una invitación para continuar la operación fuera de SECOND VOW.\n\nPor seguridad, mantén la conversación, la oferta y el pago dentro de la plataforma.';
begin
  if tg_table_name = 'offers' then v_value := to_jsonb(new) ->> 'note';
  elsif tg_table_name = 'ratings' then v_value := to_jsonb(new) ->> 'comment';
  else raise exception 'Tabla no compatible con moderación';
  end if;

  if public.has_disallowed_contact_content(v_value) then
    raise exception using errcode = 'P0001', message = v_block_message;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_safe_optional_text() from public, anon, authenticated;

drop trigger if exists offers_enforce_safe_text on public.offers;
create trigger offers_enforce_safe_text
  before insert or update of note on public.offers
  for each row execute function public.enforce_safe_optional_text();

drop trigger if exists ratings_enforce_safe_text on public.ratings;
create trigger ratings_enforce_safe_text
  before insert or update of comment on public.ratings
  for each row execute function public.enforce_safe_optional_text();

notify pgrst, 'reload schema';
commit;
