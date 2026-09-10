import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeGet } from "@/lib/server/stripe";
import { reconcilePaidCheckoutSession } from "@/lib/server/reconcileStripeCheckout";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({ orderId: "" }));
  const { data: order } = await supabase.from("orders").select("id,buyer_id,status,stripe_checkout_session_id").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== user.id) return NextResponse.json({ error: "Pedido inválido" }, { status: 404 });
  if (["paid", "preparing_shipment", "shipped", "inspection", "completed"].includes(order.status)) return NextResponse.json({ reconciled: true, status: order.status });
  if (!order.stripe_checkout_session_id) return NextResponse.json({ error: "La sesión de pago todavía no está registrada" }, { status: 409 });

  const session = await stripeGet(`/checkout/sessions/${order.stripe_checkout_session_id}`);
  if (session?.payment_status !== "paid") return NextResponse.json({ reconciled: false, status: session?.payment_status ?? "unknown" }, { status: 202 });
  await reconcilePaidCheckoutSession(session);
  return NextResponse.json({ reconciled: true });
}
