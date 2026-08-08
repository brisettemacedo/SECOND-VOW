import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.SHIP24_WEBHOOK_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  const body = await req.json();
  const admin = createAdminClient();
  for (const tracking of body?.trackings ?? []) {
    const trackerId = tracking?.tracker?.trackerId;
    if (!trackerId) continue;
    for (const event of tracking?.events ?? []) {
      const eventId = event?.eventId ?? `${trackerId}:${event?.occurrenceDatetime}:${event?.statusMilestone}`;
      const occurredAt = event?.occurrenceDatetime;
      if (!occurredAt) continue;
      const { error } = await admin.rpc("backend_process_tracking_event", {
        p_provider: "ship24",
        p_tracker_id: trackerId,
        p_provider_event_id: eventId,
        p_status_milestone: event?.statusMilestone ?? null,
        p_status_code: event?.statusCode ?? null,
        p_raw_status: event?.status ?? null,
        p_occurred_at: occurredAt,
        p_payload: tracking,
      });
      if (error) console.error("Ship24 webhook:", error.message);
    }
  }
  return NextResponse.json({ received: true });
}
