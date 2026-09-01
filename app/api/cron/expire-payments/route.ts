import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, stripeRequest } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();

  // Antes de liberar nada en nuestra base, cerramos en Stripe cualquier
  // página de pago que siga abierta para un pedido ya vencido. Así el
  // segundo intento de cobro queda BLOQUEADO por Stripe (la compradora ve
  // "esta sesión expiró"), en vez de dejar la puerta abierta y solo
  // reembolsar si alguien alcanza a pagar por ahí.
  const skipOrderIds: string[] = [];
  try {
    const { data: expiring, error: listError } = await admin.rpc("backend_list_expiring_checkouts");
    if (listError) throw new Error(listError.message);
    for (const row of expiring ?? []) {
      const sessionId = row.stripe_checkout_session_id as string | null;
      if (!sessionId) continue;
      try {
        const session = await stripeGet(`/checkout/sessions/${sessionId}`);
        if (session?.status === "complete" || session?.payment_status === "paid") {
          // Ya se pagó en Stripe justo antes de que corriera el cron: no lo
          // toques, deja que el webhook lo procese con normalidad.
          skipOrderIds.push(row.order_id as string);
        } else if (session?.status === "open") {
          await stripeRequest(`/checkout/sessions/${sessionId}/expire`, new URLSearchParams(), undefined, `cron_expire_${row.order_id}`);
        }
      } catch {
        // Si Stripe ya la había cerrado o falla la consulta puntual, seguimos:
        // el paso de base de datos abajo igual cancela el pedido vencido.
      }
    }
  } catch {
    // Si ni siquiera pudimos listar, seguimos con el barrido de base de
    // datos de todas formas: es preferible liberar tarde que no liberar.
  }

  const { data, error } = await admin.rpc("backend_expire_abandoned_payments", { p_skip_order_ids: skipOrderIds });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ released: data ?? 0, skipped: skipOrderIds.length });
}
