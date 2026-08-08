"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PayoutsClient({ orders }: { orders: any[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function request(orderId: string) {
    setBusy(orderId);
    const res = await fetch("/api/stripe/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
    const json = await res.json();
    setBusy("");
    if (!res.ok) alert(json.error || "No fue posible solicitar el retiro"); else router.refresh();
  }

  return <div className="cards-list">
    {orders.map(order => <article className="panel" key={order.id}>
      <h3>{order.dresses?.model || "Vestido"}</h3>
      <p>Saldo de la operación: ${Number(order.seller_net_after_processor_mxn ?? order.seller_net_mxn ?? 0).toLocaleString("es-MX")} MXN</p>
      <p><span className="badge">{order.seller_payouts?.[0]?.status ?? "held"}</span></p>
      {order.seller_payouts?.[0]?.status === "releasable" && <button className="btn btn-primary" disabled={busy === order.id} onClick={() => request(order.id)}>Solicitar retiro</button>}
    </article>)}
    {!orders.length && <p>No hay saldos por retirar.</p>}
  </div>;
}
