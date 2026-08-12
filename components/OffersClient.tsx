"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function dressTitle(d:any){const raw=String(d?.model??"").trim();const model=/^(na|n\/?a|no aplica|sin modelo)$/i.test(raw)?"":raw;return [d?.brands?.name,model].filter(Boolean).join(" ")||"Vestido"}

export default function OffersClient({ offers, userId }: { offers: any[]; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [counterAmounts, setCounterAmounts] = useState<Record<string, string>>({});

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

  async function counter(id: string) {
    const amount = Number(counterAmounts[id]);
    if (!amount) return;
    setBusy(id);
    const { error } = await supabase.rpc("counter_offer", { p_offer_id: id, p_amount_mxn: amount, p_note: null });
    setBusy("");
    if (error) alert(error.message); else router.refresh();
  }

  return <div className="cards-list">
    {offers.map(o => {
      const isCreator = o.created_by === userId;
      const canRespond = o.status === "pending" && !isCreator;
      const canCancel = o.status === "pending" && isCreator;
      return <article className="panel" key={o.id}>
        <h2>{dressTitle(o.dresses)}</h2>
        <p>${Number(o.amount_mxn).toLocaleString("es-MX")} MXN | <span className="badge">{o.status}</span></p>
        {o.note && <p>{o.note}</p>}
        <p className="muted">Expira: {new Date(o.expires_at).toLocaleString("es-MX")}</p>
        {canRespond && <div className="actions-stack">
          <div className="actions">
            <button className="btn btn-primary" disabled={busy === o.id} onClick={() => accept(o.id)}>Aceptar</button>
            <button className="btn btn-secondary" disabled={busy === o.id} onClick={() => decline(o.id)}>Rechazar</button>
          </div>
          <div className="inline-offer offer-entry">
            <label className="offer-amount-field"><span>Contraoferta (MXN)</span><input aria-label="Monto de contraoferta en MXN" type="number" min={1} value={counterAmounts[o.id] ?? ""} onChange={e => setCounterAmounts(v => ({ ...v, [o.id]: e.target.value }))} placeholder="Monto" /></label>
            <button className="btn btn-secondary" disabled={busy === o.id || !counterAmounts[o.id]} onClick={() => counter(o.id)}>Contraofertar</button>
          </div>
        </div>}
        {canCancel && <button className="btn btn-secondary" disabled={busy === o.id} onClick={() => decline(o.id)}>Cancelar oferta</button>}
      </article>;
    })}
    {!offers.length && <p>No hay ofertas todavía.</p>}
  </div>;
}
