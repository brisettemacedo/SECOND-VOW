import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { createShip24Tracker } from "@/lib/server/ship24";
import { consumeRateLimit } from "@/lib/server/rateLimit";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!await consumeRateLimit(user.id, "return_tracking_register", 8, 3600)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const carrier = typeof body.carrier === "string" ? body.carrier.trim().slice(0, 80) : "";
  const trackingNumber = typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 120) : "";
  if (!orderId || !carrier || !trackingNumber) return NextResponse.json({ error: "Faltan datos de devolución" }, { status: 400 });
  const { error: returnError } = await supabase.rpc("register_return_shipment", { p_order_id: orderId, p_carrier: carrier, p_tracking_number: trackingNumber });
  if (returnError) return NextResponse.json({ error: returnError.message }, { status: 400 });
  const admin = createAdminClient();
  const { data: shipment } = await admin.from("shipments").select("id").eq("order_id", orderId).eq("direction", "return").single();
  if (!shipment) return NextResponse.json({ error: "No se encontró la devolución" }, { status: 500 });
  try {
    const result = await createShip24Tracker({ trackingNumber, clientTrackerId: shipment.id, shipmentReference: `RETURN_${orderId}` });
    const trackerId = result?.data?.tracker?.trackerId ?? result?.tracker?.trackerId ?? result?.data?.trackerId ?? result?.trackerId;
    if (!trackerId) throw new Error("Ship24 no devolvió trackerId");
    await admin.from("shipments").update({ tracking_provider: "ship24", tracking_provider_id: trackerId, tracking_registered_at: new Date().toISOString(), tracking_error: null }).eq("id", shipment.id);
    return NextResponse.json({ ok: true, trackerId });
  } catch (error: any) {
    await admin.from("shipments").update({ tracking_provider: "ship24", tracking_error: error?.message ?? "Error Ship24" }).eq("id", shipment.id);
    return NextResponse.json({ ok: true, trackingPending: true, warning: "La guía se guardó, pero el seguimiento automático quedó pendiente de validación." });
  }
}
