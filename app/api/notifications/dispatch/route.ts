import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";
import { consumeRateLimit } from "@/lib/server/rateLimit";
import { sendPendingNotificationEmails } from "@/lib/server/notificationEmail";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!await consumeRateLimit(user.id, "notification_dispatch", 20, 600)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  return NextResponse.json(await sendPendingNotificationEmails(20));
}
