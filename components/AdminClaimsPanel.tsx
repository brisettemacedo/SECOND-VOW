"use client";

import Link from "next/link";
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

const CLAIM_LABELS: Record<string, string> = {
  not_received: "La guía indica entrega, pero la compradora no recibió el paquete",
  false_or_materially_incorrect: "El vestido no coincide materialmente con la publicación",
  damaged_undisclosed: "Daño relevante no informado",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Esperando respuesta de la vendedora",
  under_review: "En revisión",
  seller_response: "Respuesta recibida",
  approved_return: "Devolución autorizada",
  rejected: "Reclamación rechazada",
  return_shipped: "Devolución en tránsito",
  refund_pending: "Reembolso pendiente",
};

type FormState = {
  action: "authorize_return" | "reject";
  liability: "seller" | "buyer" | "carrier" | "platform" | "shared" | "none";
  matrixCode: string;
  reason: string;
  applyCharge: boolean;
};

function initial(claim: any): FormState {
  const resolution = claim.claim_resolutions?.[0];
  return {
    action: resolution?.decision ?? "authorize_return",
    liability: resolution?.liability ?? "seller",
    matrixCode: resolution?.matrix_code ?? "seller_misrepresentation",
    reason: resolution?.reason ?? "",
    applyCharge: Boolean(resolution?.seller_charge_selected),
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
    const isAppealed = claim.claim_resolutions?.[0]?.status === "appealed";
    if (form.reason.trim().length < 10) return alert("Registra un motivo claro de al menos 10 caracteres.");
    if (!form.matrixCode) return alert("Selecciona el supuesto de resolución.");
    if (form.applyCharge && (form.action !== "authorize_return" || form.liability !== "seller")) return alert("El cargo del 18% solo puede aplicarse cuando la devolución sea atribuible a la vendedora.");
    if (!confirm(`${form.action === "authorize_return" ? "Autorizar devolución" : "Rechazar reclamación"}. ${isAppealed ? "Esta será la decisión final." : "Las partes tendrán tres días para pedir revisión."} ¿Continuar?`)) return;
    setBusy(claim.id);
    const { data, error } = await supabase.rpc("admin_resolve_claim_v2", {
      p_claim_id: claim.id,
      p_action: form.action,
      p_liability: form.liability,
      p_matrix_code: form.matrixCode,
      p_reason: form.reason.trim(),
      p_apply_seller_charge: form.applyCharge,
      p_return_shipping_mxn: 0,
      p_processor_cost_mxn: Math.max(0, Math.round(Number(claim.orders?.processor_fee_mxn) || 0)),
      p_final: isAppealed,
    });
    setBusy("");
    if (error) return alert(error.message);
    const estimate = Number(data?.seller_charge_estimate_mxn ?? 0);
    alert(estimate ? `Decisión registrada. Cargo estimado: $${estimate.toLocaleString("es-MX")} MXN, sujeto al reembolso confirmado.` : "Decisión registrada y notificada a ambas partes.");
    router.refresh();
  }

  async function refund(claim: any) {
    if (!confirm("¿Confirmas el reembolso total al medio de pago original? La operación no duplicará el reembolso.")) return;
    setBusy(claim.id);
    const res = await fetch("/api/stripe/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return alert(json.error || "No fue posible procesar el reembolso");
    router.refresh();
  }

  return <section className="panel" id="reclamaciones">
    <h2>Reclamaciones y devoluciones</h2>
    <div className="claim-process"><span><strong>1</strong> La compradora reporta</span><span><strong>2</strong> La vendedora responde</span><span><strong>3</strong> SECOND VOW decide</span></div>
    <p className="muted">Si la devolución se atribuye a la vendedora, ella proporciona una guía prepagada; la compradora no adelanta ese gasto.</p>
    {claims.map((claim) => {
      const form = forms[claim.id] ?? initial(claim);
      const resolution = claim.claim_resolutions?.[0];
      const total = Number(claim.orders?.amount_charged_mxn ?? claim.orders?.total_mxn ?? 0);
      const estimate = Math.round(total * .18);
      const replyOpen = !claim.seller_responded_at && claim.seller_response_due_at && new Date(claim.seller_response_due_at).getTime() > Date.now();
      const oldTerms = String(claim.orders?.checkout_terms_version ?? "") < "2026-09-12.1";
      const isAppealed = resolution?.status === "appealed";
      return <article className="admin-compact-item admin-claim" key={claim.id}>
        <div className="admin-title"><div><strong>{CLAIM_LABELS[claim.reason_code ?? claim.reason] ?? claim.reason}</strong><p><strong>Relato de la compradora:</strong> {claim.description}</p></div><span className="badge">{STATUS_LABELS[claim.status] ?? claim.status}</span></div>
        <div className={claim.seller_response ? "alert-info" : "claim-reply-pending"}><strong>Respuesta de la vendedora</strong>{claim.seller_response ? <p>{claim.seller_response}</p> : <p>{replyOpen ? `Puede responder hasta ${new Date(claim.seller_response_due_at).toLocaleString("es-MX")}.` : "No respondió dentro del plazo."}</p>}</div>
        <Link className="btn btn-secondary" href={`/pedidos/${claim.order_id}`} target="_blank">Ver pedido y evidencia</Link>
        {resolution && <div className="alert-info"><strong>{isAppealed ? "Decisión impugnada" : resolution.status === "final" ? "Decisión final" : "Decisión provisional"}</strong><p>{resolution.reason}</p>{resolution.appeal_deadline_at && <small>Revisión hasta {new Date(resolution.appeal_deadline_at).toLocaleString("es-MX")}</small>}{resolution.appeal_reason && <p><strong>Solicitud de revisión:</strong> {resolution.appeal_reason}</p>}</div>}
        {replyOpen && <div className="alert-info"><strong>Aún no puede resolverse.</strong><p>Espera la respuesta de la vendedora o el vencimiento del plazo.</p></div>}
        {!replyOpen && ["open", "under_review", "seller_response", "rejected", "approved_return"].includes(claim.status) && <div className="claim-decision-grid">
          <label className="field"><span>Decisión</span><select value={form.action} onChange={(event) => update(claim.id, { action: event.target.value as FormState["action"], applyCharge: event.target.value === "reject" ? false : form.applyCharge })}><option value="authorize_return">Autorizar devolución</option><option value="reject">Rechazar reclamación</option></select></label>
          <label className="field"><span>¿A quién corresponde el incumplimiento?</span><select value={form.liability} onChange={(event) => update(claim.id, { liability: event.target.value as FormState["liability"], applyCharge: event.target.value !== "seller" ? false : form.applyCharge })}><option value="seller">Vendedora</option><option value="buyer">Compradora</option><option value="carrier">Paquetería</option><option value="platform">SECOND VOW / procesador</option><option value="shared">Responsabilidad compartida</option><option value="none">No se acreditó</option></select></label>
          <label className="field"><span>Hecho acreditado</span><select value={form.matrixCode} onChange={(event) => update(claim.id, { matrixCode: event.target.value })}>{MATRIX.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="field claim-reason"><span>Motivo de la decisión (obligatorio)</span><textarea rows={4} maxLength={2000} value={form.reason} onChange={(event) => update(claim.id, { reason: event.target.value })} placeholder="Explica qué hechos y evidencia sustentan la decisión" /></label>
          <label className="field claim-reason"><span>Cargo por incumplimiento de la vendedora</span><select value={form.applyCharge ? "yes" : "no"} disabled={oldTerms || form.action !== "authorize_return" || form.liability !== "seller"} onChange={(event) => update(claim.id, { applyCharge: event.target.value === "yes" })}><option value="no">No aplicar</option><option value="yes">Aplicar 18% del reembolso confirmado (estimado: ${estimate.toLocaleString("es-MX")} MXN)</option></select><small>{oldTerms ? "No disponible: este pedido aceptó términos anteriores." : "Solo se registra después de que Stripe confirme el reembolso; no se duplica la comisión."}</small></label>
          {form.action === "authorize_return" && form.liability === "seller" && <div className="alert-info claim-reason"><strong>Envío de regreso</strong><p>La vendedora deberá cargar una guía prepagada. Después, la compradora la usará y confirmará la entrega a paquetería.</p></div>}
          <button className="btn btn-primary" disabled={busy === claim.id} onClick={() => decide(claim)}>{busy === claim.id ? "Guardando…" : isAppealed ? "Confirmar decisión final" : "Registrar decisión provisional"}</button>
        </div>}
        {claim.status === "return_shipped" && <span>Devolución en tránsito.</span>}
        {claim.status === "refund_pending" && <button className="btn btn-primary" disabled={busy === claim.id} onClick={() => refund(claim)}>Reembolsar ahora</button>}
      </article>;
    })}
    {!claims.length && <p className="muted">Sin reclamaciones pendientes.</p>}
  </section>;
}
