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
  const { data: payoutId, error } = await supabase.rpc("request_seller_payout", { p_order_id: orderId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const admin = createAdminClient();
  const { data: p } = await admin.from("seller_payouts").select("id,amount_mxn,connected_account_id,transfer_id,payout_id").eq("id", payoutId).single();
  const { data: o } = await admin.from("orders").select("stripe_charge_id").eq("id", orderId).single();
  if (!p?.connected_account_id || !o?.stripe_charge_id) return NextResponse.json({ error: "Faltan referencias de Stripe" }, { status: 409 });
  try {
    let transferId = p.transfer_id;
    if (!transferId) {
      const t = new URLSearchParams();
      t.set("amount", String(Math.round(Number(p.amount_mxn) * 100))); t.set("currency", "mxn");
      t.set("destination", p.connected_account_id); t.set("source_transaction", o.stripe_charge_id);
      t.set("metadata[order_id]", orderId);
      const transfer = await stripeRequest("/transfers", t);
      transferId = transfer.id;
      await admin.rpc("backend_mark_transfer_created", { p_payout_row_id: p.id, p_transfer_id: transfer.id });
    }
    const po = new URLSearchParams(); po.set("amount", String(Math.round(Number(p.amount_mxn) * 100))); po.set("currency", "mxn"); po.set("metadata[order_id]", orderId);
    const payout = await stripeRequest("/payouts", po, p.connected_account_id);
    await admin.rpc("backend_update_payout", { p_payout_row_id: p.id, p_status: "processing", p_provider_payout_id: payout.id, p_failure_code: null });
    return NextResponse.json({ ok: true, transferId, payoutId: payout.id });
  } catch (e: any) {
    await admin.rpc("backend_update_payout", { p_payout_row_id: p.id, p_status: "failed", p_provider_payout_id: null, p_failure_code: e?.message ?? "stripe_error" });
    return NextResponse.json({ error: e?.message ?? "No fue posible solicitar el retiro" }, { status: 502 });
  }
}
