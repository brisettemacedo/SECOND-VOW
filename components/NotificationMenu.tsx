"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notificationHref, notificationPresentation } from "@/lib/notifications";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  order_id?: string | null;
  dress_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export default function NotificationMenu({ initial }: { initial: NotificationRow[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [open, setOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function markRead(id: string) {
    setNotifications((rows) => rows.filter((row) => row.id !== id));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }

  if (!notifications.length) return null;

  return (
    <div className="notification-menu">
      <button
        type="button"
        className="notification-trigger"
        aria-label={`${notifications.length} notificaciones pendientes`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">Avisos</span>
        <span className="nav-count">{notifications.length > 9 ? "9+" : notifications.length}</span>
      </button>
      {open && (
        <div className="notification-popover" role="dialog" aria-label="Notificaciones">
          <div className="notification-popover-title">Notificaciones</div>
          {notifications.slice(0, 5).map((notification) => {
            const href = notificationHref(notification);
            const copy = notificationPresentation(notification);
            return (
              <div className="notification-item" key={notification.id}>
                <Link href={href} onClick={() => void markRead(notification.id)}>
                  <strong>{copy.title}</strong>
                  <span>{copy.body}</span>
                  <small>
                    <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleDateString("es-MX")}</time>
                    <b>{copy.action} →</b>
                  </small>
                </Link>
                <button type="button" aria-label="Marcar como leída" onClick={() => void markRead(notification.id)}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
