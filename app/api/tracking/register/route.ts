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
  if (!await consumeRateLimit(user.id, "tracking_register", 10, 3600)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const carrier = typeof body.carrier === "string" ? body.carrier.trim().slice(0, 80) : "";
  const trackingNumber = typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 120) : "";
  const courierCode = typeof body.courierCode === "string" ? body.courierCode.trim().slice(0, 80) : undefined;
  const insured = body.insured === true;
  const signature = body.signature === true;
  if (!orderId || !carrier || !trackingNumber) return NextResponse.json({ error: "Faltan datos del envío" }, { status: 400 });

  const { error: shipError } = await supabase.rpc("mark_order_shipped", { p_order_id: orderId, p_carrier: carrier, p_tracking_number: trackingNumber, p_insured: insured, p_signature: signature });
  if (shipError) return NextResponse.json({ error: shipError.message }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: shipment, error }, { data: order }] = await Promise.all([
    admin.from("shipments").select("id").eq("order_id", orderId).eq("direction", "outbound").single(),
    admin.from("orders").select("public_code").eq("id", orderId).single(),
  ]);
  if (error || !shipment) return NextResponse.json({ error: "No se encontró el envío creado" }, { status: 500 });
  try {
    const result = await createShip24Tracker({ trackingNumber, clientTrackerId: shipment.id, shipmentReference: order?.public_code || orderId, courierCode });
    const trackerId = result?.data?.tracker?.trackerId ?? result?.tracker?.trackerId ?? result?.data?.trackerId ?? result?.trackerId;
    if (!trackerId) throw new Error("Ship24 no devolvió trackerId");
    await admin.rpc("backend_register_tracking_provider", { p_order_id: orderId, p_provider: "ship24", p_provider_tracker_id: trackerId, p_error: null });
    return NextResponse.json({ ok: true, trackerId });
  } catch (error: any) {
    await admin.rpc("backend_register_tracking_provider", { p_order_id: orderId, p_provider: "ship24", p_provider_tracker_id: null, p_error: error?.message ?? "Error Ship24" });
    return NextResponse.json({ ok: true, trackingPending: true, warning: `El envío quedó registrado, pero el rastreo automático no pudo iniciar: ${error?.message ?? "revisa la API key y la guía"}.` });
  }
}
