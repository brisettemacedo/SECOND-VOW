-- One in-app reminder per seven days and at most one email per fourteen days.
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
      d.id as dress_id,
      not exists (
        select 1
        from public.notifications e
        where e.user_id = d.seller_id
          and e.kind in ('weekly_draft_reminder', 'draft_publication_help')
          and e.email_status in ('pending', 'failed', 'sent')
          and e.created_at > now() - interval '14 days'
      ) as email_due
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
    user_id, dress_id, kind, title, body, metadata, email_status
  )
  select
    c.seller_id,
    c.dress_id,
    'weekly_draft_reminder',
    'Para vender más rápido',
    'Para vender más rápido: Finaliza tu borrador! :)',
    jsonb_build_object(
      'href_path', '/publicar/' || c.dress_id::text,
      'in_app_cadence_days', 7,
      'email_cadence_days', 14,
      'email_subject', 'Tu vestido está a un paso de publicarse 🤍',
      'email_body', E'¡Hermosa!\n\nNo olvides terminar tu borrador para que tu vestido pueda publicarse y encontrar a su próxima novia. ✨\n\nCompleta los campos marcados con * y selecciona “Publicar vestido”. Los demás datos son opcionales.'
    ),
    case when c.email_due then 'pending' else 'not_required' end
  from candidates c;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.backend_queue_weekly_draft_notifications()
  from public, anon, authenticated;
grant execute on function public.backend_queue_weekly_draft_notifications()
  to service_role;

commit;
