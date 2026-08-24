import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeRequest } from "@/lib/server/stripe";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data: expiredPayments, error: expireError } = await admin.rpc("backend_expire_abandoned_payments");
  if (expireError) return NextResponse.json({ error: expireError.message }, { status: 500 });
  const { data, error } = await admin.rpc("backend_finalize_expired_inspections");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pending } = await admin.from("orders").select("id,amount_charged_mxn,total_mxn,stripe_charge_id,stripe_dispute_status").eq("status", "refund_pending").eq("shipping_block_reason", "shipping_deadline_expired").is("shipped_at", null).limit(50);
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
      params.set("metadata[reason]", "seller_shipping_deadline_expired");
      const refund = await stripeRequest("/refunds", params, undefined, `shipping_deadline_refund_${order.id}`);
      const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "processing";
      const { error: recordError } = await admin.rpc("backend_record_refund", { p_order_id: order.id, p_provider_refund_id: refund.id, p_amount_mxn: amount, p_status: status, p_reason_code: "order_cancelled" });
      if (recordError) throw new Error(recordError.message);
      refundsRequested++;
    } catch (refundError: any) { refundErrors.push(`${order.id}: ${refundError?.message ?? "error"}`); }
  }
  return NextResponse.json({ expiredPayments: expiredPayments ?? 0, finalized: data ?? 0, refundsRequested, refundErrors });
}
