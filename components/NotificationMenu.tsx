"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  metadata?: { href_path?: string } | null;
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
            const href = notification.metadata?.href_path || "/cuenta";
            const body = ["draft_publication_help", "weekly_draft_reminder"].includes(notification.kind)
              ? "Para vender más rápido: Finaliza tu borrador! :)"
              : notification.body;
            return (
              <div className="notification-item" key={notification.id}>
                <Link href={href} onClick={() => void markRead(notification.id)}>
                  <strong>{body}</strong>
                  <small>{new Date(notification.created_at).toLocaleDateString("es-MX")}</small>
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
