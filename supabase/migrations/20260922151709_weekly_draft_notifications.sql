-- Recordatorio semanal, solo dentro de la plataforma, para quienes tienen
-- al menos un vestido incompleto. El cron diario puede ejecutar esta función
-- sin duplicar avisos: cada usuaria recibe como máximo uno cada siete días.
begin;

create or replace function public.backend_queue_weekly_draft_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  with candidates as (
    select distinct on (d.seller_id)
      d.seller_id,
      d.id as dress_id
    from public.dresses d
    join public.profiles p on p.id = d.seller_id
    where d.status in ('draft', 'changes_requested')
      and d.removed_by_seller_at is null
      and p.role = 'user'
      and coalesce(p.is_blocked, false) = false
      and d.updated_at < now() - interval '24 hours'
      and d.updated_at > now() - interval '365 days'
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = d.seller_id
          and n.kind in ('weekly_draft_reminder', 'draft_publication_help')
          and n.created_at > now() - interval '7 days'
      )
    order by d.seller_id, d.updated_at desc
  )
  insert into public.notifications (
    user_id,
    dress_id,
    kind,
    title,
    body,
    metadata,
    email_status
  )
  select
    c.seller_id,
    c.dress_id,
    'weekly_draft_reminder',
    'Para vender más rápido',
    'Para vender más rápido: Finaliza tu borrador! :)',
    jsonb_build_object(
      'href_path', '/publicar/' || c.dress_id::text,
      'cadence', 'weekly'
    ),
    'not_required'
  from candidates c;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.backend_queue_weekly_draft_notifications() from public, anon, authenticated;
grant execute on function public.backend_queue_weekly_draft_notifications() to service_role;

commit;
