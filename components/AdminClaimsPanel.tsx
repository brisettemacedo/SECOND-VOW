"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { claimResolution } from "@/lib/claimResolution";

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
  const resolution = claimResolution(claim);
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
  const [returnForms, setReturnForms] = useState<Record<string, { instructions: string; mode: string; reason: string; verified: boolean }>>({});
  const [busy, setBusy] = useState("");

  function update(id: string, values: Partial<FormState>) {
    setForms((current) => ({ ...current, [id]: { ...(current[id] ?? initial(claims.find((claim) => claim.id === id))), ...values } }));
  }

  async function decide(claim: any) {
    const form = forms[claim.id] ?? initial(claim);
    const isAppealed = claimResolution(claim)?.status === "appealed";
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
    void fetch("/api/notifications/dispatch", { method: "POST" }).catch(() => undefined);
    router.refresh();
  }

  async function refund(claim: any) {
    if (!confirm("¿Confirmas el reembolso total al medio de pago original? La operación no duplicará el reembolso.")) return;
    setBusy(claim.id);
    const res = await fetch("/api/stripe/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return alert(json.error || "No fue posible procesar el reembolso");
    void fetch("/api/notifications/dispatch", { method: "POST" }).catch(() => undefined);
    router.refresh();
  }

  function returnForm(claim: any) {
    return returnForms[claim.id] ?? { instructions: claim.return_instructions ?? "", mode: claim.return_instructions ? claim.return_shipping_payment_mode ?? "prepaid" : String(claim.orders?.checkout_terms_version ?? "") >= "2026-10-16.1" && claimResolution(claim)?.liability === "seller" ? "collect" : "prepaid", reason: "", verified: false };
  }
  function changeReturn(claim: any, values: Partial<ReturnType<typeof returnForm>>) {
    setReturnForms((current) => ({ ...current, [claim.id]: { ...returnForm(claim), ...values } }));
  }
  async function saveReturn(claim: any, review: boolean) {
    const form = returnForm(claim);
    if (review && !form.verified) return;
    setBusy(claim.id);
    const { error } = review
      ? await supabase.rpc("admin_review_return", { p_claim_id: claim.id, p_reason: form.reason.trim() })
      : await supabase.rpc("admin_set_return_instructions", { p_claim_id: claim.id, p_instructions: form.instructions.trim(), p_payment_mode: form.mode });
    setBusy("");
    if (error) return alert(error.message);
    void fetch("/api/notifications/dispatch", { method: "POST" }).catch(() => undefined);
    router.refresh();
  }

  return <section className="panel" id="reclamaciones">
    <h2>Reclamaciones</h2>
    {claims.map((claim) => {
      const form = forms[claim.id] ?? initial(claim);
      const ret = returnForm(claim);
      const newReturnTerms = String(claim.orders?.checkout_terms_version ?? "") >= "2026-10-16.1";
      const reviewDeadline = Date.parse(claimResolution(claim)?.appeal_deadline_at ?? "");
      const reviewComplete = claimResolution(claim)?.status === "final" || (claimResolution(claim)?.status === "provisional" && Number.isFinite(reviewDeadline) && reviewDeadline <= Date.now());
      const resolution = claimResolution(claim);
      const total = Number(claim.orders?.amount_charged_mxn ?? claim.orders?.total_mxn ?? 0);
      const estimate = Math.round(total * .18);
      const replyOpen = !claim.seller_responded_at && claim.seller_response_due_at && new Date(claim.seller_response_due_at).getTime() > Date.now();
      const oldTerms = String(claim.orders?.checkout_terms_version ?? "") < "2026-09-12.1";
      const isAppealed = resolution?.status === "appealed";
      const canDecide = isAppealed || (!resolution && ["open", "under_review", "seller_response"].includes(claim.status));
      if (claim.status === "rejected" && !isAppealed) return <details className="admin-compact-item admin-claim" key={claim.id}>
        <summary>{CLAIM_LABELS[claim.reason_code ?? claim.reason] ?? claim.reason} · Rechazada</summary>
        <p>{claim.description}</p>
        {resolution?.reason && <p><strong>Motivo:</strong> {resolution.reason}</p>}
        <Link className="btn btn-secondary" href={`/pedidos/${claim.order_id}`}>Ver expediente</Link>
        <p className="muted">Si sigue abierto el plazo para solicitar revisión, el dinero permanece retenido, una revisión pendiente debe resolverse antes de cerrar el expediente.</p>
      </details>;
      return <article className="admin-compact-item admin-claim" key={claim.id}>
        <div className="admin-title"><div><strong>{CLAIM_LABELS[claim.reason_code ?? claim.reason] ?? claim.reason}</strong><p><strong>Relato de la compradora:</strong> {claim.description}</p></div><span className="badge">{STATUS_LABELS[claim.status] ?? claim.status}</span></div>
        <div className={claim.seller_response ? "alert-info" : "claim-reply-pending"}><strong>Respuesta de la vendedora</strong>{claim.seller_response ? <p>{claim.seller_response}</p> : <p>{replyOpen ? `Puede responder hasta ${new Date(claim.seller_response_due_at).toLocaleString("es-MX")}.` : canDecide ? "No respondió dentro del plazo." : "No hay respuesta registrada."}</p>}</div>
        <Link className="btn btn-secondary" href={`/pedidos/${claim.order_id}`} target="_blank">Ver pedido y evidencia</Link>
        {resolution && <div className="alert-info"><strong>{isAppealed ? "Decisión impugnada" : resolution.status === "final" ? "Decisión final" : "Decisión provisional"}</strong><p>{resolution.reason}</p>{resolution.appeal_deadline_at && <small>Revisión hasta {new Date(resolution.appeal_deadline_at).toLocaleString("es-MX")}</small>}{resolution.appeal_reason && <p><strong>Solicitud de revisión:</strong> {resolution.appeal_reason}</p>}</div>}
        {replyOpen && <div className="alert-info"><strong>Aún no puede resolverse.</strong><p>Espera la respuesta de la vendedora o el vencimiento del plazo.</p></div>}
        {!replyOpen && canDecide && <div className="claim-decision-grid">
          <label className="field"><span>Resultado</span><select value={form.action} onChange={(event) => update(claim.id, { action: event.target.value as FormState["action"], applyCharge: event.target.value === "reject" ? false : form.applyCharge })}><option value="authorize_return">Autorizar devolución</option><option value="reject">Rechazar reclamación</option></select></label>
          <label className="field"><span>Responsable</span><select value={form.liability} onChange={(event) => update(claim.id, { liability: event.target.value as FormState["liability"], applyCharge: event.target.value !== "seller" ? false : form.applyCharge })}><option value="seller">Vendedora</option><option value="buyer">Compradora</option><option value="carrier">Paquetería</option><option value="platform">SECOND VOW / procesador</option><option value="shared">Responsabilidad compartida</option><option value="none">No se acreditó</option></select></label>
          <label className="field"><span>Qué ocurrió</span><select value={form.matrixCode} onChange={(event) => update(claim.id, { matrixCode: event.target.value })}>{MATRIX.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="field claim-reason"><span>Por qué tomas esta decisión</span><textarea rows={4} maxLength={2000} value={form.reason} onChange={(event) => update(claim.id, { reason: event.target.value })} placeholder="Resume los hechos y la evidencia" /></label>
          <label className="field claim-reason"><span>Cargo por incumplimiento de la vendedora</span><select value={form.applyCharge ? "yes" : "no"} disabled={oldTerms || form.action !== "authorize_return" || form.liability !== "seller"} onChange={(event) => update(claim.id, { applyCharge: event.target.value === "yes" })}><option value="no">No aplicar</option><option value="yes">Aplicar 18% del reembolso confirmado (estimado: ${estimate.toLocaleString("es-MX")} MXN)</option></select><small>{oldTerms ? "No disponible: este pedido aceptó términos anteriores." : "Solo se registra después de que Stripe confirme el reembolso; no se duplica la comisión."}</small></label>
          {form.action === "authorize_return" && form.liability === "seller" && <div className="alert-info claim-reason"><strong>Si autorizas la devolución</strong><p>La vendedora asume el costo del retorno autorizado y debe recibirlo, SECOND VOW confirma las instrucciones, verifica la guía y el comprobante y mantiene retenido el dinero hasta resolver el expediente.</p></div>}
          {!isAppealed && <p className="muted claim-reason">Las partes podrán pedir una revisión dentro de tres días. No se hará un reembolso desde este botón.</p>}
          <button className="btn btn-primary" disabled={busy === claim.id} onClick={() => decide(claim)}>{busy === claim.id ? "Guardando…" : isAppealed ? "Confirmar decisión final" : "Resolver reclamación"}</button>
        </div>}
        {claim.status === "approved_return" && !isAppealed && <div className="claim-decision-grid"><label className="field claim-reason"><span>Destino e instrucciones autorizadas de devolución</span><textarea rows={5} maxLength={2000} value={ret.instructions} onChange={(e) => changeReturn(claim, { instructions: e.target.value })} placeholder="Confirma nombre, dirección completa, teléfono y condiciones con la paquetería, indica cómo enviar el vestido" /></label><label className="field"><span>Pago del flete</span><select value={ret.mode} onChange={(e) => changeReturn(claim, { mode: e.target.value })}><option value="prepaid">Guía prepagada</option>{newReturnTerms && resolution?.liability === "seller" && <option value="collect">La vendedora paga al recibir</option>}</select><small>Confirma cobertura y disponibilidad con la paquetería, no se contrata automáticamente.</small></label><button className="btn btn-primary" disabled={busy === claim.id || ret.instructions.trim().length < 20} onClick={() => saveReturn(claim, false)}>Compartir instrucciones con ambas partes</button></div>}
        {["return_shipped", "returned", "refund_pending"].includes(claim.status) && <div className="claim-decision-grid"><p className="claim-reason"><strong>Dinero retenido hasta resolver el expediente</strong><br />Guía: {claim.return_carrier || "Sin paquetería"} · {claim.return_tracking_number || "Sin guía"}, la recepción de la vendedora no es condición para resolver</p>{!claim.return_reviewed_at ? <><label className="field claim-reason"><span>Validación del retorno y solución documentada</span><textarea rows={4} maxLength={2000} value={ret.reason} onChange={(e) => changeReturn(claim, { reason: e.target.value })} placeholder="Documenta la comprobación de la guía, admisión física, destino, contenido y cualquier incidencia o rechazo injustificado, explica por qué el expediente está resuelto" /></label><label className="check claim-reason"><input type="checkbox" checked={ret.verified} onChange={(e) => changeReturn(claim, { verified: e.target.checked })} /><span>Verifiqué la guía y el comprobante de admisión o la entrega acreditada, revisé las incidencias y documenté la solución del expediente</span></label>{!reviewComplete && <p className="muted claim-reason">Espera a que termine el plazo de revisión o resuelve la revisión pendiente, el dinero sigue retenido.</p>}<button className="btn btn-secondary" disabled={busy === claim.id || !reviewComplete || !ret.verified || ret.reason.trim().length < 20} onClick={() => saveReturn(claim, true)}>Registrar verificación y solución, sin reembolsar</button></> : <><p>Retorno verificado por SECOND VOW, el dinero sigue retenido hasta autorizar el reembolso</p><button className="btn btn-primary" disabled={busy === claim.id || !reviewComplete} onClick={() => refund(claim)}>Autorizar reembolso al medio de pago original</button></>}</div>}
      </article>;
    })}
    {!claims.length && <p className="muted">Sin reclamaciones pendientes.</p>}
  </section>;
}
