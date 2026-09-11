import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";
import { sendPendingNotificationEmails } from "@/lib/server/notificationEmail";

const CAMPAIGN = "2026-09-11-publicacion-marca-no-bloqueante";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data: queued, error } = await supabase.rpc("admin_queue_draft_reminders", { p_campaign: CAMPAIGN });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const email = await sendPendingNotificationEmails(25, ["draft_publication_help"]);
  return NextResponse.json({ campaign: CAMPAIGN, queued, ...email });
}
