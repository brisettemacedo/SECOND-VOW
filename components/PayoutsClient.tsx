"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayoutsClient({ orders, bankLinked }: { orders: any[]; bankLinked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  const payouts=orders.flatMap(order=>(order.seller_payouts??[]).map((p:any)=>({...p,order})));
  const pending=payouts.filter((p:any)=>["held","releasable"].includes(p.status));
  const total=pending.reduce((sum:number,p:any)=>sum+Number(p.amount_mxn??0),0);
  const releasable=pending.filter((p:any)=>p.status==="releasable");
  async function requestAll() {
    setBusy("all");
    for (const payout of releasable) {
      const res = await fetch("/api/stripe/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId:payout.order.id }) });
      if (!res.ok) { const json=await res.json().catch(()=>({})); alert(json.error||"No fue posible solicitar todos los retiros"); break; }
    }
    setBusy(""); router.refresh();
  }
  return <section className="panel"><span className="muted">Saldo pendiente por cobrar</span><h2>${total.toLocaleString("es-MX")} MXN</h2>
    {bankLinked&&releasable.length>0&&<button className="btn btn-primary" disabled={busy==="all"} onClick={requestAll}>{busy?"Procesando…":`Retirar $${releasable.reduce((s:number,p:any)=>s+Number(p.amount_mxn||0),0).toLocaleString("es-MX")}`}</button>}
    {!total&&<p>No hay saldos pendientes.</p>}
    {!!payouts.length&&<details><summary>Ver desglose</summary>{payouts.map((p:any)=><p key={`${p.order.id}-${p.status}`}>{p.order.dresses?.model||"Vestido"}: ${Number(p.amount_mxn||0).toLocaleString("es-MX")} · {p.status}</p>)}</details>}
  </section>;
}
