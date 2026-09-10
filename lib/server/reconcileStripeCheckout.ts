import "server-only";

import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, stripeRequest } from "@/lib/server/stripe";

export function orderIdFromSession(session: any) {
  return session?.metadata?.order_id || session?.client_reference_id || null;
}

/** Concilia una sesión pagada. Es idempotente en la base de datos. */
export async function reconcilePaidCheckoutSession(session: any) {
  const admin = createAdminClient();
  const orderId = orderIdFromSession(session);
  if (!orderId || !session?.payment_intent) throw new Error("El pago no contiene referencias del pedido");

  const pi = await stripeGet(`/payment_intents/${session.payment_intent}`);
  if (pi?.status !== "succeeded") throw new Error(`PaymentIntent todavía no liquidado: ${pi?.status ?? "desconocido"}`);
  const charge = pi.latest_charge ? await stripeGet(`/charges/${pi.latest_charge}?expand[]=balance_transaction`) : null;
  const processorFeeMxn = charge?.balance_transaction?.fee == null ? null : Math.round(Number(charge.balance_transaction.fee) / 100);
  const amountReceivedMxn = Math.round(Number(pi.amount_received ?? session.amount_total ?? 0) / 100);
  const { data: result, error } = await admin.rpc("backend_mark_payment_paid", {
    p_order_id: orderId,
    p_payment_intent_id: pi.id,
    p_charge_id: pi.latest_charge,
    p_checkout_session_id: session.id,
    p_processor_fee_mxn: processorFeeMxn,
    p_amount_received_mxn: amountReceivedMxn,
    p_currency: String(pi.currency ?? session.currency ?? "").toUpperCase(),
  });
  if (error) throw new Error(error.message);

  if (result === "paid") {
    const { data: winner } = await admin.from("orders").select("dress_id").eq("id", orderId).single();
    if (winner?.dress_id) {
      const { data: losers } = await admin.from("orders").select("id,stripe_checkout_session_id").eq("dress_id", winner.dress_id).neq("id", orderId).eq("payment_failure_code", "another_buyer_paid_first");
      for (const loser of losers ?? []) {
        if (loser.stripe_checkout_session_id) {
          try { await stripeRequest(`/checkout/sessions/${loser.stripe_checkout_session_id}/expire`, new URLSearchParams(), undefined, `expire_loser_${loser.id}`); } catch { /* la conciliación tardía se reembolsa abajo */ }
        }
      }
    }
  }

  if (result === "payment_review") {
    const { data: exception } = await admin.from("payment_exceptions").select("id,details").eq("order_id", orderId).eq("payment_intent_id", pi.id).eq("exception_type", "dress_no_longer_available").eq("status", "open").maybeSingle();
    if (exception?.id) {
      try {
        const params = new URLSearchParams();
        params.set("charge", pi.latest_charge);
        params.set("amount", String(Math.round(amountReceivedMxn * 100)));
        params.set("reason", "requested_by_customer");
        params.set("metadata[order_id]", orderId);
        params.set("metadata[reason]", "dress_no_longer_available");
        const refund = await stripeRequest("/refunds", params, undefined, `auto_refund_race_${orderId}_${pi.id}`);
        const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "processing";
        const { error: refundError } = await admin.rpc("backend_refund_losing_race_order", { p_order_id: orderId, p_provider_refund_id: refund.id, p_amount_mxn: amountReceivedMxn, p_status: status });
        if (refundError) throw new Error(refundError.message);
        await admin.from("payment_exceptions").update({ status: "refunded", resolved_at: new Date().toISOString() }).eq("id", exception.id);
      } catch (refundError: any) {
        await admin.from("payment_exceptions").update({ details: { ...(exception.details ?? {}), auto_refund_error: refundError?.message ?? "error" } }).eq("id", exception.id);
      }
    }
  }

  return { orderId, result };
}
