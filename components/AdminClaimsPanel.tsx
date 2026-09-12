"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MATRIX = [
  ["seller_misrepresentation", "Información falsa o daño no declarado · vendedora"],
  ["seller_shipping_breach", "Incumplimiento de envío o embalaje · vendedora"],
  ["carrier_damage", "Daño o pérdida atribuible a paquetería"],
  ["buyer_fit_or_remorse", "Talla, ajuste o cambio de opinión · no cubierto"],
  ["buyer_address_or_misuse", "Domicilio incorrecto, uso o alteración · compradora"],
  ["platform_or_processor", "Error de plataforma o procesamiento"],
  ["insufficient_evidence", "Evidencia insuficiente para acreditar incumplimiento"],
  ["mutual_cancellation", "Cancelación acordada antes del envío"],
] as const;

type FormState = {
  action: "authorize_return" | "reject";
  liability: "seller" | "buyer" | "carrier" | "platform" | "shared" | "none";
  matrixCode: string;
  reason: string;
  applyCharge: boolean;
  returnShipping: string;
  final: boolean;
};

function initial(claim: any): FormState {
  const resolution = claim.claim_resolutions?.[0];
  return {
    action: resolution?.decision ?? "authorize_return",
    liability: resolution?.liability ?? "seller",
    matrixCode: resolution?.matrix_code ?? "seller_misrepresentation",
    reason: resolution?.reason ?? "",
    applyCharge: Boolean(resolution?.seller_charge_selected),
    returnShipping: String(resolution?.return_shipping_mxn ?? 0),
    final: resolution?.status === "appealed",
  };
}

export default function AdminClaimsPanel({ claims }: { claims: any[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, FormState>>(() => Object.fromEntries(claims.map((claim) => [claim.id, initial(claim)])));
  const [busy, setBusy] = useState("");

  function update(id: string, values: Partial<FormState>) {
    setForms((current) => ({ ...current, [id]: { ...(current[id] ?? initial(claims.find((claim) => claim.id === id))), ...values } }));
  }

  async function decide(claim: any) {
    const form = forms[claim.id] ?? initial(claim);
    if (form.reason.trim().length < 10) return alert("Registra un motivo claro de al menos 10 caracteres.");
    if (!form.matrixCode) return alert("Selecciona el supuesto de resolución.");
    if (form.applyCharge && (form.action !== "authorize_return" || form.liability !== "seller")) return alert("El cargo del 18% solo puede aplicarse cuando la devolución sea atribuible a la vendedora.");
    if (!confirm(`${form.action === "authorize_return" ? "Autorizar devolución" : "Rechazar reclamación"}. La decisión y su motivo quedarán en el expediente. ¿Continuar?`)) return;
    setBusy(claim.id);
    const { data, error } = await supabase.rpc("admin_resolve_claim_v2", {
      p_claim_id: claim.id,
      p_action: form.action,
      p_liability: form.liability,
      p_matrix_code: form.matrixCode,
      p_reason: form.reason.trim(),
      p_apply_seller_charge: form.applyCharge,
      p_return_shipping_mxn: Math.max(0, Math.round(Number(form.returnShipping) || 0)),
      p_processor_cost_mxn: Math.max(0, Math.round(Number(claim.orders?.processor_fee_mxn) || 0)),
      p_final: form.final,
    });
    setBusy("");
    if (error) return alert(error.message);
    const estimate = Number(data?.seller_charge_estimate_mxn ?? 0);
    alert(estimate ? `Decisión registrada. Cargo estimado por incumplimiento: $${estimate.toLocaleString("es-MX")} MXN, sujeto al reembolso efectivamente procesado.` : "Decisión registrada y notificada a ambas partes.");
    router.refresh();
  }

  async function refund(claim: any) {
    if (!confirm("¿Confirmas el reembolso total al medio de pago original? La operación es idempotente y no duplicará el reembolso.")) return;
    setBusy(claim.id);
    const res = await fetch("/api/stripe/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return alert(json.error || "No fue posible procesar el reembolso");
    router.refresh();
  }

  return <section className="panel" id="reclamaciones">
    <h2>Reclamaciones y devoluciones</h2>
    <p className="muted">Toda decisión exige supuesto, responsabilidad y motivo. El cargo no es automático: solo se genera después de un reembolso confirmado y atribuible a la vendedora.</p>
    {claims.map((claim) => {
      const form = forms[claim.id] ?? initial(claim);
      const resolution = claim.claim_resolutions?.[0];
      const total = Number(claim.orders?.amount_charged_mxn ?? claim.orders?.total_mxn ?? 0);
      const estimate = Math.round(total * .18);
      return <article className="admin-compact-item admin-claim" key={claim.id}>
        <div className="admin-title"><div><strong>{claim.reason}</strong><p>{claim.description}</p></div><span className="badge">{claim.status}</span></div>
        {resolution && <div className="alert-info"><strong>Decisión {resolution.status}</strong><p>{resolution.reason}</p><small>Responsabilidad: {resolution.liability} · revisión hasta {new Date(resolution.appeal_deadline_at).toLocaleString("es-MX")}</small>{resolution.appeal_reason && <p><strong>Solicitud de revisión:</strong> {resolution.appeal_reason}</p>}</div>}
        {["open", "under_review", "seller_response", "rejected", "approved_return"].includes(claim.status) && <div className="claim-decision-grid">
          <label className="field"><span>Decisión</span><select value={form.action} onChange={(event) => update(claim.id, { action: event.target.value as FormState["action"], applyCharge: event.target.value === "reject" ? false : form.applyCharge })}><option value="authorize_return">Autorizar devolución</option><option value="reject">Rechazar reclamación</option></select></label>
          <label className="field"><span>Responsabilidad</span><select value={form.liability} onChange={(event) => update(claim.id, { liability: event.target.value as FormState["liability"], applyCharge: event.target.value !== "seller" ? false : form.applyCharge })}><option value="seller">Vendedora</option><option value="buyer">Compradora</option><option value="carrier">Paquetería</option><option value="platform">SECOND VOW / procesador</option><option value="shared">Compartida</option><option value="none">No acreditada</option></select></label>
          <label className="field"><span>Supuesto</span><select value={form.matrixCode} onChange={(event) => update(claim.id, { matrixCode: event.target.value })}>{MATRIX.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="field"><span>Guía de retorno comprobable (MXN)</span><input type="number" min="0" step="1" value={form.returnShipping} onChange={(event) => update(claim.id, { returnShipping: event.target.value })} /></label>
          <label className="field claim-reason"><span>Motivo de la decisión (obligatorio)</span><textarea rows={4} maxLength={2000} value={form.reason} onChange={(event) => update(claim.id, { reason: event.target.value })} /></label>
          <div className="legal-checks claim-options">
            <label className="check"><input type="checkbox" checked={form.applyCharge} disabled={form.action !== "authorize_return" || form.liability !== "seller"} onChange={(event) => update(claim.id, { applyCharge: event.target.checked })} /><span>Aplicar cargo por incumplimiento equivalente al 18% del reembolso confirmado (${estimate.toLocaleString("es-MX")} MXN estimados), sin duplicar la comisión ordinaria.</span></label>
            <label className="check"><input type="checkbox" checked={form.final} onChange={(event) => update(claim.id, { final: event.target.checked })} /><span>Decisión final después de revisar una inconformidad. Si no se marca, las partes tendrán tres días para pedir revisión.</span></label>
          </div>
          <button className="btn btn-primary" disabled={busy === claim.id} onClick={() => decide(claim)}>{busy === claim.id ? "Guardando…" : "Registrar decisión motivada"}</button>
        </div>}
        {claim.status === "return_shipped" && <span>Devolución en tránsito.</span>}
        {claim.status === "refund_pending" && <button className="btn btn-primary" disabled={busy === claim.id} onClick={() => refund(claim)}>Reembolsar ahora</button>}
      </article>;
    })}
    {!claims.length && <p className="muted">Sin reclamaciones pendientes.</p>}
  </section>;
}
