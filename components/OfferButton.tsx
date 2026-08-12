"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OfferButton({ dressId, price, userId, sellerId }: { dressId: string; price: number; userId?: string; sellerId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(Math.round(price * 0.9));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!userId) {
      router.push(`/login?next=/vestidos/${dressId}`);
      return;
    }
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("create_offer", {
      p_dress_id: dressId,
      p_amount_mxn: amount,
      p_conversation_id: null,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setMsg("Oferta enviada. Tendrá vigencia de 48 horas.");
      setOpen(false);
      router.refresh();
    }
  }

  if (userId === sellerId) return null;

  return <div>
    {!open ? <button className="btn btn-secondary" onClick={() => setOpen(true)}>Hacer oferta</button> :
      <div className="inline-offer offer-entry">
        <label className="offer-amount-field"><span>Monto de la oferta (MXN)</span><input aria-label="Monto de la oferta en MXN" type="number" min={1} max={price} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
        <label className="offer-note-field"><span>Mensaje opcional</span><input type="text" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Ej. ¿Aceptarías esta cantidad?" /></label>
        <button className="btn btn-primary" disabled={busy || amount <= 0 || amount > price} onClick={send}>Enviar oferta</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
      </div>}
    {msg && <small>{msg}</small>}
  </div>;
}
