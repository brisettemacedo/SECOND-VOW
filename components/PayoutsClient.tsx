"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayoutsClient({ orders, debts, bankLinked }: { orders: any[]; debts: any[]; bankLinked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  const payouts=orders.flatMap(order=>(order.seller_payouts??[]).map((p:any)=>({...p,order})));
  const pending=payouts.filter((p:any)=>["held","releasable"].includes(p.status));
  const total=pending.reduce((sum:number,p:any)=>sum+Number(p.gross_amount_mxn??p.amount_mxn??0),0);
  const debtTotal=debts.reduce((sum:number,debt:any)=>sum+Math.max(0,Number(debt.original_amount_mxn??0)-Number(debt.recovered_amount_mxn??0)),0);
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
    <p className="muted">Este saldo es el 82% del total cobrado (vestido + envío). De aquí pagarás la guía acordada con la compradora.</p>
    {debtTotal>0&&<div className="alert-info"><strong>Adeudo documentado: ${debtTotal.toLocaleString("es-MX")} MXN</strong><p>Se compensará únicamente con saldos futuros antes de transferirlos. SECOND VOW no hará un débito automático a tu tarjeta ni a tu cuenta bancaria.</p></div>}
    {bankLinked&&releasable.length>0&&<button className="btn btn-primary" disabled={busy==="all"} onClick={requestAll}>{busy?"Procesando…":`Retirar $${releasable.reduce((s:number,p:any)=>s+Number(p.amount_mxn||0),0).toLocaleString("es-MX")}`}</button>}
    {!total&&<p>No hay saldos pendientes.</p>}
    {!!payouts.length&&<details><summary>Ver desglose</summary>{payouts.map((p:any)=><p key={`${p.order.id}-${p.status}`}>{p.order.dresses?.model||"Vestido"}: saldo ${Number(p.gross_amount_mxn??p.amount_mxn??0).toLocaleString("es-MX")}{Number(p.debt_offset_mxn)>0?` · compensación $${Number(p.debt_offset_mxn).toLocaleString("es-MX")} · transferencia $${Number(p.transfer_amount_mxn??0).toLocaleString("es-MX")}`:""} · {p.status}</p>)}</details>}
  </section>;
}
