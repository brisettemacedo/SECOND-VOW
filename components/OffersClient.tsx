"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function dressTitle(d:any){const raw=String(d?.model??"").trim();const model=/^(na|n\/?a|no aplica|sin modelo)$/i.test(raw)?"":raw;return [d?.brands?.name,model].filter(Boolean).join(" ")||"Vestido"}

export default function OffersClient({ offers, userId }: { offers: any[]; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function accept(id: string) {
    setBusy(id);
    const { data, error } = await supabase.rpc("accept_offer", { p_offer_id: id });
    setBusy("");
    if (error) alert(error.message);
    else {
      router.push(`/pedidos/${data}`);
      router.refresh();
    }
  }

  async function decline(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("decline_offer", { p_offer_id: id });
    setBusy("");
    if (error) alert(error.message); else router.refresh();
  }

  async function cancel(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("cancel_offer", { p_offer_id: id });
    setBusy("");
    if (error) alert(error.message); else router.refresh();
  }

  return <div className="cards-list">
    {offers.map(o => {
      const canRespond = o.status === "pending" && o.buyer_id === userId;
      const canCancel = o.status === "pending" && o.seller_id === userId;
      const total = Number(o.amount_mxn || 0) + Number(o.shipping_mxn || 0);
      return <article className="panel" key={o.id}>
        <h2>{dressTitle(o.dresses)}</h2>
        <p>Vestido ${Number(o.amount_mxn).toLocaleString("es-MX")} + envío ${Number(o.shipping_mxn || 0).toLocaleString("es-MX")} = <strong>${total.toLocaleString("es-MX")} MXN</strong> | <span className="badge">{o.status}</span></p>
        {o.seller_id === userId && <p className="muted">Recibirás aproximadamente ${Math.round(total * 0.82).toLocaleString("es-MX")} MXN y de ahí pagarás la guía. SECOND VOW retiene 18% del total.</p>}
        {o.note && <p>{o.note}</p>}
        <p className="muted">Expira: {new Date(o.expires_at).toLocaleString("es-MX")}</p>
        {canRespond && <div className="actions-stack">
          <div className="actions">
            <button className="btn btn-primary" disabled={busy === o.id} onClick={() => accept(o.id)}>Aceptar y continuar al pago</button>
            <button className="btn btn-secondary" disabled={busy === o.id} onClick={() => decline(o.id)}>Rechazar</button>
          </div>
        </div>}
        {canCancel && <button className="btn btn-secondary" disabled={busy === o.id} onClick={() => cancel(o.id)}>Cancelar oferta pendiente</button>}
      </article>;
    })}
    {!offers.length && <p>No hay ofertas todavía.</p>}
  </div>;
}
