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
  if (!await consumeRateLimit(user.id, "checkout", 8, 600)) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const accepted = body.accepted === true;
  const termsVersion = typeof body.termsVersion === "string" ? body.termsVersion.trim() : "";
  if (!orderId || !accepted || !termsVersion) return NextResponse.json({ error: "Debes aceptar las condiciones específicas de la compra" }, { status: 400 });

  const { data: basicOrder } = await supabase
    .from("orders")
    .select("id,buyer_id,status,stripe_checkout_session_id,payment_deadline_at,checkout_terms_version,checkout_terms_accepted_at,checkout_charge_acknowledged_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!basicOrder || basicOrder.buyer_id !== user.id) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  if (!basicOrder.checkout_terms_accepted_at || !basicOrder.checkout_charge_acknowledged_at || basicOrder.checkout_terms_version !== termsVersion) return NextResponse.json({ error: "No se encontró la aceptación legal de esta operación" }, { status: 409 });

  if (basicOrder.status === "payment_processing" && basicOrder.stripe_checkout_session_id) {
    try {
      const existing = await stripeGet(`/checkout/sessions/${basicOrder.stripe_checkout_session_id}`);
      if (existing?.status === "open" && existing?.url) return NextResponse.json({ url: existing.url });
    } catch {
      // La RPC inferior decide si el intento todavía puede reanudarse.
    }
  }

  const admin = createAdminClient();
  const { data: financials, error: financialError } = await admin.rpc("backend_prepare_order_financials", { p_order_id: orderId });
  if (financialError) return NextResponse.json({ error: financialError.message }, { status: 400 });
  const financialOrder = Array.isArray(financials) ? financials[0] : financials;
  if (!financialOrder) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  // La falta de datos bancarios de la vendedora NO bloquea la compra: el
  // cobro se procesa directo a la cuenta de SECOND VOW (no hay transferencia
  // a una cuenta conectada en este paso). El dinero de la vendedora queda
  // registrado como saldo pendiente por cobrar (seller_payouts.status='held')
  // y solo se le exige completar Stripe Connect al momento de RETIRAR ese
  // saldo (ver request_seller_payout en 0018), que es donde sí es necesario.
  const { data: started, error: startError } = await admin.rpc("backend_begin_checkout", { p_order_id: orderId });
  if (startError) return NextResponse.json({ error: startError.message }, { status: 409 });
  const order = Array.isArray(started) ? started[0] : started;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!site) {
    await admin.rpc("backend_release_checkout", { p_order_id: orderId, p_reason: "missing_site_url" });
    return NextResponse.json({ error: "Falta configurar NEXT_PUBLIC_SITE_URL" }, { status: 500 });
  }

  try {
    const group = `SV_${order.id.replaceAll("-", "")}`;
    const p = new URLSearchParams();
    p.set("mode", "payment");
    p.set("success_url", `${site}/pedidos/${order.id}?payment=success`);
    p.set("cancel_url", `${site}/pedidos/${order.id}?payment=cancelled`);
    p.set("expires_at", String(Math.floor(Date.now() / 1000) + 60 * 60));
    p.set("payment_method_types[0]", "card");
    p.set("client_reference_id", order.id);
    if (user.email) p.set("customer_email", user.email);
    p.set("line_items[0][price_data][currency]", "mxn");
    p.set("line_items[0][price_data][product_data][name]", "Compra protegida SECOND VOW");
    p.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(order.amount_charged_mxn ?? order.total_mxn) * 100)));
    p.set("line_items[0][quantity]", "1");
    p.set("metadata[order_id]", order.id);
    p.set("payment_intent_data[metadata][order_id]", order.id);
    p.set("payment_intent_data[transfer_group]", group);
    const session = await stripeRequest("/checkout/sessions", p, undefined, `checkout_${order.id}`);

    const { error: saveError } = await admin.rpc("backend_attach_checkout_session", {
      p_order_id: order.id,
      p_checkout_session_id: session.id,
      p_transfer_group: group,
    });
    if (saveError) throw new Error(saveError.message);
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: `${error?.message ?? "No fue posible iniciar el pago"}. No se realizó un cargo confirmado; puedes intentarlo nuevamente.` }, { status: 502 });
  }
}
