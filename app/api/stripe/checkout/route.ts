import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeRequest } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { orderId } = await req.json();
  const { data: basicOrder } = await supabase.from("orders").select("id,buyer_id").eq("id", orderId).maybeSingle();
  if (!basicOrder || basicOrder.buyer_id !== user.id) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const admin = createAdminClient();
  const { data: financials, error } = await admin.rpc("backend_prepare_order_financials", { p_order_id: orderId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const o = Array.isArray(financials) ? financials[0] : financials;
  if (!o) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const { data: sellerAccount } = await admin.from("seller_payment_accounts").select("onboarding_status,payouts_enabled,provider_account_id").eq("user_id", o.seller_id).maybeSingle();
  if (!sellerAccount?.provider_account_id || sellerAccount.onboarding_status !== "complete" || !sellerAccount.payouts_enabled) {
    return NextResponse.json({ error: "La vendedora debe completar la vinculación bancaria antes de recibir pagos." }, { status: 409 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const group = `SV_${o.id.replaceAll("-", "")}`;
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", `${site}/pedidos/${o.id}?payment=success`);
  p.set("cancel_url", `${site}/pedidos/${o.id}?payment=cancelled`);
  p.set("client_reference_id", o.id);
  p.set("customer_email", user.email ?? "");
  p.set("line_items[0][price_data][currency]", "mxn");
  p.set("line_items[0][price_data][product_data][name]", "Compra protegida SECOND VOW");
  p.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(o.amount_charged_mxn ?? o.total_mxn) * 100)));
  p.set("line_items[0][quantity]", "1");
  p.set("metadata[order_id]", o.id);
  p.set("payment_intent_data[metadata][order_id]", o.id);
  p.set("payment_intent_data[transfer_group]", group);
  const session = await stripeRequest("/checkout/sessions", p);
  await admin.from("orders").update({ status: "payment_processing", stripe_checkout_session_id: session.id, stripe_transfer_group: group, updated_at: new Date().toISOString() }).eq("id", o.id);
  return NextResponse.json({ url: session.url });
}
