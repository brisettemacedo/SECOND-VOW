import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, stripeRequest } from "@/lib/server/stripe";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();

  // Igual que en /api/cron/expire-payments: cerramos primero en Stripe
  // cualquier sesión de pago vencida, para bloquear un segundo cobro en
  // vez de solo reembolsarlo después de que ya ocurrió.
  const skipOrderIds: string[] = [];
  try {
    const { data: expiring } = await admin.rpc("backend_list_expiring_checkouts");
    for (const row of expiring ?? []) {
      const sessionId = row.stripe_checkout_session_id as string | null;
      if (!sessionId) continue;
      try {
        const session = await stripeGet(`/checkout/sessions/${sessionId}`);
        if (session?.status === "complete" || session?.payment_status === "paid") {
          skipOrderIds.push(row.order_id as string);
        } else if (session?.status === "open") {
          await stripeRequest(`/checkout/sessions/${sessionId}/expire`, new URLSearchParams(), undefined, `cron_expire_${row.order_id}`);
        }
      } catch { /* seguimos: la base de datos igual cancela el pedido vencido */ }
    }
  } catch { /* seguimos con el barrido de base de datos de todas formas */ }

  const { data: expiredPayments, error: expireError } = await admin.rpc("backend_expire_abandoned_payments", { p_skip_order_ids: skipOrderIds });
  if (expireError) return NextResponse.json({ error: expireError.message }, { status: 500 });
  const { data, error } = await admin.rpc("backend_finalize_expired_inspections");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pending } = await admin.from("orders").select("id,amount_charged_mxn,total_mxn,stripe_charge_id,stripe_dispute_status,shipping_block_reason").eq("status", "refund_pending").in("shipping_block_reason", ["shipping_deadline_expired", "seller_cancelled"]).is("shipped_at", null).limit(50);
  let refundsRequested = 0;
  const refundErrors: string[] = [];
  for (const order of pending ?? []) {
    if (!order.stripe_charge_id || (order.stripe_dispute_status && order.stripe_dispute_status !== "won")) continue;
    try {
      const amount = Number(order.amount_charged_mxn ?? order.total_mxn);
      const params = new URLSearchParams();
      params.set("charge", order.stripe_charge_id);
      params.set("amount", String(Math.round(amount * 100)));
      params.set("reason", "requested_by_customer");
      params.set("metadata[order_id]", order.id);
      params.set("metadata[reason]", order.shipping_block_reason === "seller_cancelled" ? "seller_cancelled_before_shipping" : "seller_shipping_deadline_expired");
      const refund = await stripeRequest("/refunds", params, undefined, `${order.shipping_block_reason}_refund_${order.id}`);
      const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "processing";
      const { error: recordError } = await admin.rpc("backend_record_refund", { p_order_id: order.id, p_provider_refund_id: refund.id, p_amount_mxn: amount, p_status: status, p_reason_code: "order_cancelled" });
      if (recordError) throw new Error(recordError.message);
      refundsRequested++;
    } catch (refundError: any) { refundErrors.push(`${order.id}: ${refundError?.message ?? "error"}`); }
  }
  const { data: offerReminders } = await admin.rpc("backend_generate_offer_reminders");
  return NextResponse.json({ expiredPayments: expiredPayments ?? 0, finalized: data ?? 0, offerReminders: offerReminders ?? 0, refundsRequested, refundErrors });
}
