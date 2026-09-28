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
  return <div><p>Solo puedes adelantar la liberación si terminó la protección y no hay bloqueos.</p><label className="field"><span>Motivo</span><textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} /></label><button className="btn btn-primary" disabled={busy||reason.trim().length<8} onClick={release}>Autorizar saldo para retiro</button></div>;
}
