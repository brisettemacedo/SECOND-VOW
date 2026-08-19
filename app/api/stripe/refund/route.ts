import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeRequest } from "@/lib/server/stripe";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const claimId = typeof body.claimId === "string" ? body.claimId : "";
  if (!claimId) return NextResponse.json({ error: "Reclamación inválida" }, { status: 400 });
  const admin = createAdminClient();
  const { data: claim } = await admin.from("claims").select("id,order_id,status").eq("id", claimId).maybeSingle();
  if (!claim || !["returned", "refund_pending"].includes(claim.status)) {
    return NextResponse.json({ error: "La devolución todavía no está lista para reembolso" }, { status: 409 });
  }
  const { data: order } = await admin.from("orders").select("id,status,amount_charged_mxn,total_mxn,stripe_charge_id").eq("id", claim.order_id).single();
  const { data: payout } = await admin.from("seller_payouts").select("id,status,amount_mxn,transfer_id").eq("order_id", claim.order_id).maybeSingle();
  if (!order?.stripe_charge_id) return NextResponse.json({ error: "El pedido no tiene un cargo conciliado" }, { status: 409 });

  try {
    if (payout?.transfer_id && !["reversed", "failed"].includes(payout.status)) {
      const reversal = new URLSearchParams();
      reversal.set("amount", String(Math.round(Number(payout.amount_mxn) * 100)));
      reversal.set("metadata[order_id]", order.id);
      await stripeRequest(`/transfers/${payout.transfer_id}/reversals`, reversal, undefined, `reversal_${payout.id}`);
    }
    const amountMxn = Number(order.amount_charged_mxn ?? order.total_mxn);
    const params = new URLSearchParams();
    params.set("charge", order.stripe_charge_id);
    params.set("amount", String(Math.round(amountMxn * 100)));
    params.set("reason", "requested_by_customer");
    params.set("metadata[order_id]", order.id);
    params.set("metadata[claim_id]", claim.id);
    const refund = await stripeRequest("/refunds", params, undefined, `refund_${claim.id}`);
    const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "processing";
    const { error } = await admin.rpc("backend_record_refund", { p_order_id: order.id, p_provider_refund_id: refund.id, p_amount_mxn: amountMxn, p_status: status, p_reason_code: "claim_approved" });
    if (error) throw new Error(error.message);
    await admin.from("claims").update({ status: status === "succeeded" ? "refunded" : "refund_pending", refund_amount_mxn: amountMxn, resolved_at: status === "succeeded" ? new Date().toISOString() : null }).eq("id", claim.id);
    return NextResponse.json({ ok: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "No fue posible procesar el reembolso" }, { status: 502 });
  }
}
