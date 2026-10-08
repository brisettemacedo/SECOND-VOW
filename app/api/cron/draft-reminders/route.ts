import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { sendPendingNotificationEmails } from "@/lib/server/notificationEmail";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: queued, error } = await admin.rpc("backend_queue_weekly_draft_notifications");
  if (error) {
    console.error("draft-reminders: queue failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const email = await sendPendingNotificationEmails(40, ["weekly_draft_reminder", "draft_publication_help"]);
  console.log("draft-reminders", { queued: queued ?? 0, ...email });
  return NextResponse.json({ queued: queued ?? 0, ...email }, { status: email.skipped || email.failed > 0 ? 503 : 200 });
}
