import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, stripeRequest, verifyStripeSignature } from "@/lib/server/stripe";
import { sendPendingNotificationEmails } from "@/lib/server/notificationEmail";

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
          try { await stripeRequest(`/checkout/sessions/${loser.stripe_checkout_session_id}/expire`, new URLSearchParams(), undefined, `expire_loser_${loser.id}`); } catch { /* el webhook tardío se reembolsa abajo */ }
        }
        // El RPC ganador ya canceló estos pedidos atómicamente. Aquí solo se
        // expiran las sesiones externas de Stripe que todavía estuvieran abiertas.
      }
    }
  }

  // Red de seguridad para la carrera real (dos pagos casi simultáneos):
  // si este pago llegó tarde porque el vestido YA se vendió con otro pedido,
  // el importe se reembolsa aquí mismo, sin esperar a que un admin lo note.
  // Los otros tipos de excepción (moneda o importe distinto de lo esperado)
  // sí se dejan para revisión humana, porque pueden indicar manipulación
  // o un error de integración que vale la pena mirar antes de devolver el dinero.
  if (result === "payment_review") {
    const { data: exception } = await admin
      .from("payment_exceptions")
      .select("id,exception_type,status,details")
      .eq("order_id", orderId)
      .eq("payment_intent_id", pi.id)
      .eq("exception_type", "dress_no_longer_available")
      .eq("status", "open")
      .maybeSingle();
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
        const { error: refundError } = await admin.rpc("backend_refund_losing_race_order", {
          p_order_id: orderId, p_provider_refund_id: refund.id, p_amount_mxn: amountReceivedMxn, p_status: status,
        });
        if (refundError) throw new Error(refundError.message);
        await admin.from("payment_exceptions").update({ status: "refunded", resolved_at: new Date().toISOString() }).eq("id", exception.id);
      } catch (refundError: any) {
        // Si el reembolso automático falla (ej. Stripe no disponible), el
        // dinero queda retenido y visible en Administración para atenderlo
        // a mano; no se pierde el rastro.
        await admin.from("payment_exceptions").update({ details: { ...(exception.details ?? {}), auto_refund_error: refundError?.message ?? "error" } }).eq("id", exception.id);
      }
    }
  }
}

async function paymentIntentFromObject(object: any) {
  if (typeof object?.payment_intent === "string") return object.payment_intent;
  if (object?.payment_intent?.id) return object.payment_intent.id;
  const chargeId = typeof object?.charge === "string" ? object.charge : object?.charge?.id;
  if (!chargeId) return null;
  const charge = await stripeGet(`/charges/${chargeId}`);
  return typeof charge?.payment_intent === "string" ? charge.payment_intent : charge?.payment_intent?.id ?? null;
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
      const paymentIntentId = await paymentIntentFromObject(object);
      if (paymentIntentId) {
        const dueBy = object?.evidence_details?.due_by ? new Date(Number(object.evidence_details.due_by) * 1000).toISOString() : null;
        const { error } = await admin.rpc("backend_mark_payment_risk", { p_payment_intent_id: paymentIntentId, p_kind: "dispute", p_reference_id: object.id, p_status: object.status ?? "open", p_reason: object.reason ?? null, p_due_by: dueBy });
        if (error) throw new Error(error.message);
      }
    } else if (event.type === "radar.early_fraud_warning.created") {
      const paymentIntentId = await paymentIntentFromObject(object);
      if (paymentIntentId) {
        const { error } = await admin.rpc("backend_mark_payment_risk", { p_payment_intent_id: paymentIntentId, p_kind: "early_fraud_warning", p_reference_id: object.id, p_status: object.actionable === false ? "informational" : "actionable", p_reason: object.fraud_type ?? "suspected_fraud", p_due_by: null });
        if (error) throw new Error(error.message);
      }
    } else if (["review.opened", "review.closed"].includes(event.type)) {
      const paymentIntentId = await paymentIntentFromObject(object);
      if (paymentIntentId && event.type === "review.opened") {
        const { error } = await admin.rpc("backend_mark_payment_risk", { p_payment_intent_id: paymentIntentId, p_kind: "radar_review", p_reference_id: object.id, p_status: object.opened_reason ?? "open", p_reason: object.opened_reason ?? null, p_due_by: null });
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
  await sendPendingNotificationEmails(20).catch(() => undefined);
  return NextResponse.json({ received: true });
}
