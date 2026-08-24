import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, stripeRequest } from "@/lib/server/stripe";
import { consumeRateLimit } from "@/lib/server/rateLimit";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!await consumeRateLimit(user.id, "seller_cancel", 5, 3600)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!orderId || reason.length < 5) return NextResponse.json({ error: "Indica el motivo de la cancelación" }, { status: 400 });

  const { data: mode, error: cancellationError } = await supabase.rpc("seller_request_order_cancellation", { p_order_id: orderId, p_reason: reason });
  if (cancellationError) return NextResponse.json({ error: cancellationError.message }, { status: 409 });
  if (mode === "cancelled") return NextResponse.json({ ok: true, status: "cancelled" });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,stripe_checkout_session_id,stripe_charge_id,amount_charged_mxn,total_mxn,status,stripe_dispute_status").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Pedido inexistente" }, { status: 404 });

  try {
    if (mode === "expire_checkout") {
      if (!order.stripe_checkout_session_id) throw new Error("No existe una sesión de Stripe para cerrar");
      const session = await stripeGet(`/checkout/sessions/${order.stripe_checkout_session_id}`);
      if (session.status === "complete" || session.payment_status === "paid") throw new Error("El pago se completó mientras se solicitaba la cancelación. Recarga y cancela mediante reembolso.");
      if (session.status === "open") await stripeRequest(`/checkout/sessions/${order.stripe_checkout_session_id}/expire`, new URLSearchParams(), undefined, `seller_expire_${order.id}`);
      const { error } = await admin.rpc("backend_release_checkout", { p_order_id: order.id, p_reason: "seller_cancelled_checkout" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    if (mode === "refund") {
      if (order.stripe_dispute_status && order.stripe_dispute_status !== "won") throw new Error("Existe un contracargo abierto; no se emitirá un reembolso duplicado");
      if (!order.stripe_charge_id) throw new Error("El cargo todavía no está conciliado");
      const amount = Number(order.amount_charged_mxn ?? order.total_mxn);
      const params = new URLSearchParams();
      params.set("charge", order.stripe_charge_id);
      params.set("amount", String(Math.round(amount * 100)));
      params.set("reason", "requested_by_customer");
      params.set("metadata[order_id]", order.id);
      params.set("metadata[reason]", "seller_cancelled_before_shipping");
      const refund = await stripeRequest("/refunds", params, undefined, `seller_cancel_refund_${order.id}`);
      const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "processing";
      const { error } = await admin.rpc("backend_record_refund", { p_order_id: order.id, p_provider_refund_id: refund.id, p_amount_mxn: amount, p_status: status, p_reason_code: "order_cancelled" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status });
    }
    throw new Error("Respuesta de cancelación inválida");
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "No fue posible completar la cancelación" }, { status: 502 });
  }
}
