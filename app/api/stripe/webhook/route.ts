import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, verifyStripeSignature } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

function orderIdFromSession(session: any) {
  return session?.metadata?.order_id || session?.client_reference_id || null;
}

async function markSessionPaid(admin: ReturnType<typeof createAdminClient>, session: any) {
  const orderId = orderIdFromSession(session);
  if (!orderId || !session?.payment_intent) throw new Error("El evento pagado no contiene referencias del pedido");
  const pi = await stripeGet(`/payment_intents/${session.payment_intent}`);
  if (pi?.status !== "succeeded") throw new Error(`PaymentIntent todavía no liquidado: ${pi?.status ?? "desconocido"}`);
  const charge = pi.latest_charge ? await stripeGet(`/charges/${pi.latest_charge}?expand[]=balance_transaction`) : null;
  const processorFeeMxn = charge?.balance_transaction?.fee == null ? null : Math.round(Number(charge.balance_transaction.fee) / 100);
  const amountReceivedMxn = Math.round(Number(pi.amount_received ?? session.amount_total ?? 0) / 100);
  const { error } = await admin.rpc("backend_mark_payment_paid", {
    p_order_id: orderId,
    p_payment_intent_id: pi.id,
    p_charge_id: pi.latest_charge,
    p_checkout_session_id: session.id,
    p_processor_fee_mxn: processorFeeMxn,
    p_amount_received_mxn: amountReceivedMxn,
    p_currency: String(pi.currency ?? session.currency ?? "").toUpperCase(),
  });
  if (error) throw new Error(error.message);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const admin = createAdminClient();
  const { data: prior } = await admin.from("payment_webhook_events").select("processed_at").eq("provider", "stripe").eq("event_id", event.id).maybeSingle();
  if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  await admin.from("payment_webhook_events").upsert({ provider: "stripe", event_id: event.id, event_type: event.type, payload: event });

  try {
    const object = event.data?.object;
    if ((event.type === "checkout.session.completed" && object?.payment_status === "paid") || event.type === "checkout.session.async_payment_succeeded") {
      await markSessionPaid(admin, object);
    } else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      const orderId = orderIdFromSession(object);
      if (orderId) {
        const { error } = await admin.rpc("backend_mark_checkout_failed", { p_order_id: orderId, p_reason: event.type });
        if (error) throw new Error(error.message);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const orderId = object?.metadata?.order_id;
      if (orderId) {
        const { error } = await admin.rpc("backend_mark_checkout_failed", { p_order_id: orderId, p_reason: object?.last_payment_error?.code ?? "payment_failed" });
        if (error) throw new Error(error.message);
      }
    } else if (["payout.paid", "payout.failed", "payout.canceled"].includes(event.type)) {
      const status = event.type === "payout.paid" ? "paid_out" : "failed";
      const { data: row } = await admin.from("seller_payouts").select("id").eq("payout_id", object.id).maybeSingle();
      if (row?.id) {
        const { error } = await admin.rpc("backend_update_payout", { p_payout_row_id: row.id, p_status: status, p_provider_payout_id: object.id, p_failure_code: object.failure_code ?? event.type });
        if (error) throw new Error(error.message);
      }
    } else if (["refund.created", "refund.updated", "refund.failed"].includes(event.type)) {
      const paymentIntentId = typeof object?.payment_intent === "string" ? object.payment_intent : object?.payment_intent?.id;
      const { data: order } = await admin.from("orders").select("id").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
      if (order?.id) {
        const refundStatus = object.status === "succeeded" ? "succeeded" : object.status === "failed" ? "failed" : "processing";
        const { error } = await admin.rpc("backend_record_refund", { p_order_id: order.id, p_provider_refund_id: object.id, p_amount_mxn: Math.round(Number(object.amount) / 100), p_status: refundStatus, p_reason_code: "other" });
        if (error) throw new Error(error.message);
      }
    } else if (["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"].includes(event.type)) {
      const charge = await stripeGet(`/charges/${object.charge}`);
      if (charge?.payment_intent) {
        const { error } = await admin.rpc("backend_mark_payment_dispute", { p_payment_intent_id: charge.payment_intent, p_dispute_id: object.id, p_status: object.status ?? "open" });
        if (error) throw new Error(error.message);
      }
    } else if (event.type === "transfer.reversed") {
      await admin.from("seller_payouts").update({ status: "reversed", updated_at: new Date().toISOString() }).eq("transfer_id", object.id);
    } else if (event.type === "account.updated") {
      await admin.from("seller_payment_accounts").update({
        onboarding_status: object.details_submitted && object.payouts_enabled ? "complete" : object.details_submitted ? "restricted" : "pending",
        charges_enabled: !!object.charges_enabled,
        payouts_enabled: !!object.payouts_enabled,
        details_submitted: !!object.details_submitted,
        requirements_due: object?.requirements?.currently_due ?? [],
        verified_at: object.details_submitted && object.payouts_enabled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("provider_account_id", object.id);
      const { data: paymentAccount } = await admin.from("seller_payment_accounts").select("user_id").eq("provider_account_id", object.id).maybeSingle();
      if (paymentAccount?.user_id) {
        await admin.from("profiles").update({ identity_verified: !!(object.details_submitted && object.payouts_enabled) }).eq("id", paymentAccount.user_id);
      }
    }
    await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("provider", "stripe").eq("event_id", event.id);
  } catch (error: any) {
    await admin.from("payment_webhook_events").update({ processing_error: error?.message ?? "Error" }).eq("provider", "stripe").eq("event_id", event.id);
    return NextResponse.json({ error: "Error procesando webhook" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
