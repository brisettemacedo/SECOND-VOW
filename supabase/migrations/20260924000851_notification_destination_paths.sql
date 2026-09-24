-- Every notification points to the action it describes instead of falling
-- back to the account/profile page.
begin;

create or replace function public.set_notification_href_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_path text;
  v_conversation_id text;
begin
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  if nullif(btrim(new.metadata->>'href_path'), '') is not null then
    return new;
  end if;

  v_conversation_id := nullif(btrim(new.metadata->>'conversation_id'), '');

  if new.order_id is not null then
    v_path := '/pedidos/' || new.order_id::text;
  elsif v_conversation_id is not null then
    v_path := '/mensajes?conversation=' || v_conversation_id;
  elsif new.dress_id is not null
    and new.kind in ('draft_publication_help', 'weekly_draft_reminder', 'dress_improvement_suggested') then
    v_path := '/publicar/' || new.dress_id::text;
  elsif new.kind like 'offer\_%' escape '\' then
    v_path := '/ofertas';
  elsif new.dress_id is not null then
    v_path := '/vestidos/' || new.dress_id::text;
  else
    return new;
  end if;

  new.metadata := jsonb_set(new.metadata, '{href_path}', to_jsonb(v_path), true);
  return new;
end;
$$;

revoke all on function public.set_notification_href_path()
  from public, anon, authenticated;

drop trigger if exists notification_href_path on public.notifications;
create trigger notification_href_path
before insert or update of order_id, dress_id, kind, metadata
on public.notifications
for each row execute function public.set_notification_href_path();

update public.notifications
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{href_path}',
  to_jsonb(
    case
      when order_id is not null then '/pedidos/' || order_id::text
      when nullif(btrim(metadata->>'conversation_id'), '') is not null
        then '/mensajes?conversation=' || btrim(metadata->>'conversation_id')
      when dress_id is not null
        and kind in ('draft_publication_help', 'weekly_draft_reminder', 'dress_improvement_suggested')
        then '/publicar/' || dress_id::text
      when kind like 'offer\_%' escape '\' then '/ofertas'
      when dress_id is not null then '/vestidos/' || dress_id::text
    end
  ),
  true
)
where nullif(btrim(coalesce(metadata->>'href_path', '')), '') is null
  and (
    order_id is not null
    or nullif(btrim(metadata->>'conversation_id'), '') is not null
    or dress_id is not null
    or kind like 'offer\_%' escape '\'
  );

commit;
