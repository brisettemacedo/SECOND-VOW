"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LIABILITY: Record<string,string> = {seller:"Vendedora",buyer:"Compradora",carrier:"Paquetería",platform:"SECOND VOW / procesador",shared:"Compartida",none:"No acreditada"};
const MATRIX: Record<string,string> = {seller_misrepresentation:"Información falsa o daño no declarado",seller_shipping_breach:"Incumplimiento de envío o embalaje",carrier_damage:"Daño o pérdida en paquetería",buyer_fit_or_remorse:"Talla, ajuste o cambio de opinión",buyer_address_or_misuse:"Domicilio incorrecto, uso o alteración",platform_or_processor:"Error de plataforma o procesamiento",insufficient_evidence:"Evidencia insuficiente",mutual_cancellation:"Cancelación acordada"};

export default function ClaimResolutionStatus({ claim }: { claim: any }) {
  const resolution = claim.claim_resolutions?.[0];
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!resolution) return <div><span className="badge">En revisión</span><p>{claim.description}</p>{claim.seller_response ? <div className="alert-info"><strong>Respuesta de la vendedora</strong><p>{claim.seller_response}</p></div> : <p className="muted">La vendedora puede responder hasta {claim.seller_response_due_at ? new Date(claim.seller_response_due_at).toLocaleString("es-MX") : "la fecha indicada"}. Después, SECOND VOW revisará el expediente.</p>}</div>;
  const canAppeal = resolution.status === "provisional" && new Date(resolution.appeal_deadline_at).getTime() > Date.now();

  async function appeal() {
    if (reason.trim().length < 10) return;
    setBusy(true);
    const { error } = await supabase.rpc("appeal_claim_resolution", { p_claim_id: claim.id, p_reason: reason.trim() });
    setBusy(false);
    if (error) alert(error.message); else router.refresh();
  }

  return <article className="claim-resolution-card">
    <div className="admin-title"><strong>{resolution.decision === "authorize_return" ? "Devolución autorizada" : "Reclamación rechazada"}</strong><span className="badge">{resolution.status === "provisional" ? "Decisión provisional" : resolution.status === "appealed" ? "Revisión solicitada" : "Decisión final"}</span></div>
    <p>{resolution.reason}</p>
    <p className="muted">Responsabilidad: {LIABILITY[resolution.liability] ?? resolution.liability} · Hecho acreditado: {MATRIX[resolution.matrix_code] ?? resolution.matrix_code}</p>
    {resolution.decision === "authorize_return" && resolution.liability === "seller" && <p>La vendedora debe pagar y compartir una guía prepagada. La compradora no debe adelantar ese gasto.</p>}
    {resolution.seller_charge_selected && <p>Si Stripe confirma el reembolso, se registrará el cargo por incumplimiento indicado en la decisión. No se realizará un débito bancario automático.</p>}
    {resolution.appeal_reason && <div className="alert-info"><strong>Revisión solicitada</strong><p>{resolution.appeal_reason}</p></div>}
    {canAppeal && <div className="field"><label>Solicitar revisión antes del {new Date(resolution.appeal_deadline_at).toLocaleString("es-MX")}</label><textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica concretamente qué debe revisarse" /><button className="btn btn-secondary" disabled={busy || reason.trim().length < 10} onClick={appeal}>{busy ? "Enviando…" : "Solicitar revisión"}</button></div>}
  </article>;
}
