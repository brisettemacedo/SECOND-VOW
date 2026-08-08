import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, verifyStripeSignature } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  const event = JSON.parse(raw);
  const admin = createAdminClient();
  const { data: prior } = await admin.from("payment_webhook_events").select("processed_at").eq("provider", "stripe").eq("event_id", event.id).maybeSingle();
  if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  await admin.from("payment_webhook_events").upsert({ provider: "stripe", event_id: event.id, event_type: event.type, payload: event });
  try {
    if (event.type === "checkout.session.completed" && event.data?.object?.payment_status === "paid") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id || session.client_reference_id;
      const pi = await stripeGet(`/payment_intents/${session.payment_intent}`);
      await admin.rpc("backend_mark_payment_paid", {
        p_order_id: orderId,
        p_payment_intent_id: pi.id,
        p_charge_id: pi.latest_charge,
        p_checkout_session_id: session.id,
        p_processor_fee_mxn: null,
      });
    }
    if (event.type === "payout.paid" || event.type === "payout.failed") {
      const payout = event.data.object;
      const status = event.type === "payout.paid" ? "paid_out" : "failed";
      const { data: row } = await admin.from("seller_payouts").select("id").eq("payout_id", payout.id).maybeSingle();
      if (row?.id) await admin.rpc("backend_update_payout", { p_payout_row_id: row.id, p_status: status, p_provider_payout_id: payout.id, p_failure_code: payout.failure_code ?? null });
    }
    await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("provider", "stripe").eq("event_id", event.id);
  } catch (e: any) {
    await admin.from("payment_webhook_events").update({ processing_error: e?.message ?? "Error" }).eq("provider", "stripe").eq("event_id", event.id);
    return NextResponse.json({ error: "Error procesando webhook" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
