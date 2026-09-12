"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ClaimResolutionStatus({ claim }: { claim: any }) {
  const resolution = claim.claim_resolutions?.[0];
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!resolution) return <div><span className="badge">{claim.status}</span><p>{claim.description}</p><p className="muted">Administración está revisando el expediente.</p></div>;
  const canAppeal = resolution.status === "provisional" && new Date(resolution.appeal_deadline_at).getTime() > Date.now();

  async function appeal() {
    if (reason.trim().length < 10) return;
    setBusy(true);
    const { error } = await supabase.rpc("appeal_claim_resolution", { p_claim_id: claim.id, p_reason: reason.trim() });
    setBusy(false);
    if (error) alert(error.message); else router.refresh();
  }

  return <article className="claim-resolution-card">
    <div className="admin-title"><strong>{resolution.decision === "authorize_return" ? "Devolución autorizada" : "Reclamación rechazada"}</strong><span className="badge">{resolution.status}</span></div>
    <p>{resolution.reason}</p>
    <p className="muted">Responsabilidad: {resolution.liability} · supuesto: {String(resolution.matrix_code).replaceAll("_", " ")}</p>
    {resolution.seller_charge_selected && <p>Si Stripe confirma el reembolso, se registrará un cargo por incumplimiento atribuible a la vendedora equivalente al 18% del monto efectivamente reembolsado, más la guía de retorno comprobable indicada. No se realizará un débito bancario automático.</p>}
    {resolution.appeal_reason && <div className="alert-info"><strong>Revisión solicitada</strong><p>{resolution.appeal_reason}</p></div>}
    {canAppeal && <div className="field"><label>Solicitar revisión antes del {new Date(resolution.appeal_deadline_at).toLocaleString("es-MX")}</label><textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica concretamente qué debe revisarse" /><button className="btn btn-secondary" disabled={busy || reason.trim().length < 10} onClick={appeal}>{busy ? "Enviando…" : "Solicitar revisión"}</button></div>}
  </article>;
}
