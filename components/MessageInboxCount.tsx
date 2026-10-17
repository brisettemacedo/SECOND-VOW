"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MessageInboxCount({ initialCount, userId }: { initialCount: number; userId: string }) {
  const [count, setCount] = useState(initialCount);
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request = 0;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const current = ++request;
      const { data, error } = await supabase.rpc("count_unread_message_people");
      if (!disposed && current === request && !error) setCount(Number(data ?? 0));
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 150); };
    void refresh();
    const polling = setInterval(() => void refresh(), 30000);
    window.addEventListener("second-vow:messages-read", schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    const channel = supabase.channel(`inbox-count:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participant_state", filter: `user_id=eq.${userId}` }, schedule)
      .subscribe();
    return () => {
      disposed = true; clearTimeout(timer); clearInterval(polling);
      window.removeEventListener("second-vow:messages-read", schedule);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);
  if (!count) return null;
  return <span className="nav-count" aria-live="polite" aria-label={`${count} ${count === 1 ? "persona con mensajes sin leer" : "personas con mensajes sin leer"}`}>{count > 99 ? "99+" : count}</span>;
}
