"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminOrderControls({ orderId }: { orderId: string }) {
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function release() {
    if (!confirm("¿Confirmas que terminó la ventana de protección y no existe reclamación ni riesgo abierto?")) return;
    setBusy(true);
    const { error } = await createClient().rpc("admin_release_seller_balance", { p_order_id: orderId, p_reason: reason.trim() });
    setBusy(false);
    if (error) alert(error.message); else router.refresh();
  }
  return <section className="panel"><h2>Control administrativo del saldo</h2><p>La liberación manual solo adelanta el barrido automático. No puede saltarse la entrega, las 48 horas, una reclamación o un bloqueo de Stripe.</p><label className="field"><span>Motivo obligatorio</span><textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} /></label><button className="btn btn-primary" disabled={busy||reason.trim().length<8} onClick={release}>Autorizar saldo para retiro</button></section>;
}
