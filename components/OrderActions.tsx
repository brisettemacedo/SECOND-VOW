"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OrderEvidenceUploader from "@/components/OrderEvidenceUploader";
import Link from "next/link";
import { LEGAL_BUNDLE_SHA256, TERMS_VERSION } from "@/lib/site";
import { humanActionError } from "@/lib/actionErrors";
import { paymentTimeRemaining } from "@/lib/orderDisplay";

const CLAIM_REASONS = [["not_received", "La guía dice entregado, pero no recibí el paquete"], ["false_or_materially_incorrect", "Información falsa o materialmente incorrecta"], ["damaged_undisclosed", "Daño relevante no informado"]] as const;

export default function OrderActions({ order, userId, evidence = [] }: { order: any; userId: string; evidence?: any[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [returnTracking, setReturnTracking] = useState("");
  const [returnCarrier, setReturnCarrier] = useState("");
  const [shippingAmount, setShippingAmount] = useState(order.shipping_quote_set_at ? String(order.shipping_mxn ?? 0) : "");
  const [shippingCarrier, setShippingCarrier] = useState(order.shipping_carrier_declared ?? "");
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [checkoutTerms, setCheckoutTerms] = useState(false);
  const [chargeAcknowledged, setChargeAcknowledged] = useState(false);
  const [insured, setInsured] = useState(Boolean(order.shipping_insurance_confirmed));
  const [signature, setSignature] = useState(Boolean(order.shipping_signature_confirmed));
  const [idDelivery, setIdDelivery] = useState(false);
  const [deliveryAcknowledged, setDeliveryAcknowledged] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [failedAction, setFailedAction] = useState<"payment" | "cancellation" | "return" | "">("");

  async function rpc(name: string, args: any) {
    setBusy(true);
    const { error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) alert(error.message); else router.refresh();
  }
  async function quoteShipping() {
    const amount = Number(shippingAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    await rpc("set_order_shipping_quote", { p_order_id: order.id, p_shipping_mxn: Math.round(amount), p_carrier: shippingCarrier.trim() || null });
  }
  async function checkout() {
    if (!checkoutTerms || !chargeAcknowledged || !deliveryAcknowledged) { setActionError("Debes aceptar las condiciones de la operación, entrega contra identificación y cargo antes de pagar."); return; }
    setBusy(true); setActionError(""); setFailedAction("");
    try {
      const { error: acceptanceError } = await supabase.rpc("accept_order_checkout_terms_v2", { p_order_id: order.id, p_terms_version: TERMS_VERSION, p_legal_bundle_hash: LEGAL_BUNDLE_SHA256 });
      if (acceptanceError) throw new Error(acceptanceError.message);
      const { error: deliveryError } = await supabase.rpc("acknowledge_id_delivery", { p_order_id: order.id });
      if (deliveryError) throw new Error(deliveryError.message);
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, termsVersion: TERMS_VERSION, accepted: true }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `No fue posible iniciar el pago (${res.status})`);
      if (!json.url) throw new Error("Stripe no devolvió la página de pago.");
      window.location.assign(json.url);
    } catch (error: any) { setFailedAction("payment"); setActionError(humanActionError(error, "No pudimos abrir el pago. No se realizó ningún cargo; puedes intentarlo nuevamente.")); }
    finally { setBusy(false); }
  }
  async function ship() {
    setBusy(true);
    const res = await fetch("/api/tracking/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, carrier, trackingNumber: tracking, insured, signature, idDelivery }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) alert(json.error || "No fue posible registrar el envío"); else { if (json.warning) alert(json.warning); router.refresh(); }
  }
  async function claim() {
    if (reasonCode && description.trim()) await rpc("open_order_claim", { p_order_id: order.id, p_reason_code: reasonCode, p_description: description.trim() });
  }
  async function registerReturn() {
    setBusy(true); setActionError(""); setFailedAction("");
    const res = await fetch("/api/tracking/register-return", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, carrier: returnCarrier.trim(), trackingNumber: returnTracking.trim() }) });
    const json = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setFailedAction("return"); setActionError(json.error || "No fue posible registrar la devolución"); } else { if (json.warning) alert(json.warning); router.refresh(); }
  }
  async function sellerCancel() {
    if (!confirm(order.status === "paid" || order.status === "preparing_shipment" ? "¿Confirmas cancelar la venta? Se solicitará a Stripe el reembolso completo y no podrás enviar el vestido." : "¿Confirmas cancelar esta venta?")) return;
    setBusy(true); setActionError(""); setFailedAction("");
    const res = await fetch("/api/stripe/seller-cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, reason: cancelReason.trim() }) });
    const json = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setFailedAction("cancellation"); setActionError(humanActionError(json.error, "No pudimos completar la cancelación. No se hizo ningún cargo nuevo y el vestido sigue publicado.")); } else router.refresh();
  }

  const deadline = order.dispute_deadline_at || order.inspection_deadline_at || order.claim_deadline_at;
  const activeClaim = (order.claims ?? []).find((item: any) => !["rejected", "closed", "refunded"].includes(item.status));
  return <div className="actions-stack">
    {actionError && <div className="alert-error"><strong>{failedAction === "cancellation" ? "No se pudo cancelar la venta." : failedAction === "return" ? "No se pudo registrar la devolución." : "No se pudo iniciar el pago."}</strong><p>{actionError}</p></div>}
    {["awaiting_payment", "payment_processing"].includes(order.status) && order.payment_deadline_at && <div className="protection-deadline"><span>Plazo de pago</span><strong>{paymentTimeRemaining(order.payment_deadline_at)}</strong><span>El vestido sigue visible hasta que se confirme un pago.</span></div>}
    <div className="safety-callout"><strong>Seguridad de la operación</strong><span>Mantén pagos, acuerdos y evidencia dentro de SECOND VOW. La evidencia del estado, empaque, envío y recepción puede ser determinante.</span></div>

    {order.seller_id === userId && order.status === "awaiting_payment" && !order.offer_id && <div className="panel"><h3>Cotizar envío de pedido anterior</h3><p>Este pedido no nació de una oferta con envío fijo. Captura el costo antes del pago.</p><div className="grid-2"><div className="field"><label>Costo de envío (MXN)</label><input type="number" min={0} value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} /></div><div className="field"><label>Paquetería estimada</label><input value={shippingCarrier} onChange={(e) => setShippingCarrier(e.target.value)} /></div></div><button className="btn btn-primary" disabled={busy || shippingAmount === ""} onClick={quoteShipping}>{order.shipping_quote_set_at ? "Actualizar cotización" : "Enviar cotización"}</button></div>}

    {order.buyer_id === userId && ["awaiting_payment", "payment_processing"].includes(order.status) && <div className="panel"><h3>Pago dentro de SECOND VOW</h3><p>No realices transferencias directas. El cargo aparecerá identificado como SECOND VOW.</p>{order.shipping_quote_set_at ? <><p><strong>Vestido:</strong> ${Number(order.subtotal_mxn).toLocaleString("es-MX")} MXN<br/><strong>Envío fijo:</strong> ${Number(order.shipping_mxn).toLocaleString("es-MX")} MXN<br/><strong>Total:</strong> ${Number(order.total_mxn).toLocaleString("es-MX")} MXN</p><div className="legal-checks"><label className="check"><input type="checkbox" checked={checkoutTerms} onChange={(e) => setCheckoutTerms(e.target.checked)} /><span>Acepto los <Link href="/legal/terminos" target="_blank">Términos</Link>, la <Link href="/legal/devoluciones" target="_blank">Política de reclamaciones</Link> y el plazo de 48 horas para reportar falta de recepción, información materialmente incorrecta o daño relevante no informado.</span></label><label className="check"><input type="checkbox" checked={deliveryAcknowledged} onChange={(e) => setDeliveryAcknowledged(e.target.checked)} /><span>Entiendo que el paquete se entregará contra identificación oficial y firma a la persona indicada en el destino. Me comprometo a conservar fotografías y video del paquete cerrado, su apertura y el estado del vestido.</span></label><label className="check"><input type="checkbox" checked={chargeAcknowledged} onChange={(e) => setChargeAcknowledged(e.target.checked)} /><span>Reconozco el importe, el vestido, el destino de envío y que el cargo bancario será identificado como SECOND VOW.</span></label></div><button className="btn btn-primary" disabled={busy || !checkoutTerms || !chargeAcknowledged || !deliveryAcknowledged} onClick={checkout}>Pagar de forma segura</button></> : <div className="alert-info">Esperando la cotización de envío.</div>}</div>}

    {order.seller_id === userId && ["paid", "preparing_shipment"].includes(order.status) && !order.shipping_blocked_at && <div className="panel"><h3>Prepara y documenta el envío</h3><p>Tienes cinco días naturales desde el pago. El envío debe estar asegurado y entregarse contra identificación oficial y firma.</p><div className="evidence-guidance"><ol><li>Sube evidencia previa del vestido completo y de los daños ya informados.</li><li>Sube evidencia del paquete cerrado. El video continuo es especialmente recomendable.</li><li>Sube el comprobante de recepción de la paquetería.</li><li>Conserva los originales hasta que la operación concluya.</li></ol></div><div className="evidence-grid"><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_pre_ship" existing={evidence.filter((x: any) => x.evidence_type === "seller_pre_ship")} /><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_packed" existing={evidence.filter((x: any) => x.evidence_type === "seller_packed")} /><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_shipping_receipt" existing={evidence.filter((x: any) => x.evidence_type === "seller_shipping_receipt")} /></div><h3>Registrar guía</h3><div className="grid-2"><input placeholder="Paquetería reconocida" value={carrier} onChange={(e) => setCarrier(e.target.value)} /><input placeholder="Número de rastreo" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div><div className="legal-checks"><label className="check"><input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} /><span>Confirmo que contraté seguro de envío.</span></label><label className="check"><input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} /><span>Confirmo que contraté firma de recepción.</span></label><label className="check"><input type="checkbox" checked={idDelivery} onChange={(e) => setIdDelivery(e.target.checked)} /><span>Confirmo que contraté entrega contra identificación oficial y que la guía corresponde exactamente al destino del pedido.</span></label></div><button className="btn btn-primary" disabled={busy || !carrier.trim() || !tracking.trim() || !insured || !signature || !idDelivery || !evidence.some((x:any)=>x.evidence_type==="seller_pre_ship") || !evidence.some((x:any)=>x.evidence_type==="seller_packed") || !evidence.some((x:any)=>x.evidence_type==="seller_shipping_receipt")} onClick={ship}>Registrar envío y avisar a la compradora</button></div>}

    {order.buyer_id === userId && order.status === "shipped" && <div className="panel"><h3>Cuando recibas el paquete</h3><ol><li>Muestra identificación oficial y firma únicamente a la paquetería.</li><li>Fotografía todos los lados, etiqueta, golpes o aberturas antes de abrir.</li><li>Graba un video continuo desde el paquete cerrado hasta revisar el vestido.</li><li>Fotografía vestido, etiquetas, accesorios y cualquier diferencia.</li><li>Conserva el empaque durante las 48 horas de protección.</li><li>No laves, alteres, repares ni uses el vestido antes de concluir la revisión.</li></ol><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_package_received" existing={evidence.filter((x: any) => x.evidence_type === "buyer_package_received")} /><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_unboxing" existing={evidence.filter((x: any) => x.evidence_type === "buyer_unboxing")} /><button className="btn btn-primary" disabled={busy} onClick={() => rpc("confirm_order_delivered", { p_order_id: order.id })}>Confirmar recepción</button></div>}

    {order.buyer_id === userId && ["inspection", "delivered"].includes(order.status) && <div className="panel"><h3>Revisa tu vestido</h3><p>Tienes 48 horas desde que SECOND VOW registró la entrega. Puedes reportar que no recibiste el paquete aunque la guía diga entregado, información falsa o materialmente incorrecta y daño relevante no informado. No procede porque no te quede, no te favorezca o cambies de opinión.</p>{deadline && <div className="protection-deadline"><span>Protección hasta</span><strong>{new Date(deadline).toLocaleString("es-MX")}</strong></div>}<OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_dress_received" existing={evidence.filter((x: any) => x.evidence_type === "buyer_dress_received")} /><hr /><h3>Abrir reclamación</h3><div className="field"><label>Motivo</label><select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}><option value="">Selecciona</option>{CLAIM_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>Describe concretamente lo ocurrido</label><textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div><button className="btn btn-secondary" disabled={busy || !reasonCode || !description.trim()} onClick={claim}>Abrir reclamación</button></div>}

    {order.buyer_id === userId && order.status === "return_authorized" && activeClaim?.status === "approved_return" && <div className="panel"><h3>Enviar devolución</h3><p>Entrega el vestido a paquetería antes de {activeClaim.return_shipping_deadline_at ? new Date(activeClaim.return_shipping_deadline_at).toLocaleString("es-MX") : "la fecha indicada"}. Usa rastreo y conserva evidencia.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_return_packed" existing={evidence.filter((x: any) => x.evidence_type === "buyer_return_packed")} /><div className="grid-2"><input placeholder="Paquetería" value={returnCarrier} onChange={(e) => setReturnCarrier(e.target.value)} /><input placeholder="Número de guía" value={returnTracking} onChange={(e) => setReturnTracking(e.target.value)} /></div><button className="btn btn-primary" disabled={busy || !returnCarrier.trim() || !returnTracking.trim()} onClick={registerReturn}>Registrar devolución</button></div>}

    {order.seller_id === userId && order.status === "return_shipped" && <div className="panel"><h3>Devolución en tránsito</h3><p>Cuando recibas el vestido, revisa y conserva evidencia. La confirmación habilita el reembolso administrativo.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_return_received" existing={evidence.filter((x: any) => x.evidence_type === "seller_return_received")} /><button className="btn btn-primary" disabled={busy} onClick={() => rpc("confirm_return_received", { p_order_id: order.id })}>Confirmar devolución recibida</button></div>}

    {order.status === "returned" && <div className="alert-info">La devolución fue recibida. SECOND VOW debe completar el reembolso al medio de pago original.</div>}
    {order.status === "payment_review" && <div className="alert-error">El pago requiere conciliación manual. No envíes el vestido hasta que administración resuelva el caso.</div>}
    {order.status === "chargeback_open" && <div className="alert-error"><strong>NO ENVÍES.</strong> La compradora desconoció el cargo y Stripe abrió un contracargo. El envío y el retiro están bloqueados.</div>}
    {order.seller_id === userId && ["awaiting_payment", "payment_processing", "paid", "preparing_shipment"].includes(order.status) && !order.shipped_at && <div className="panel"><h3>Cancelar venta</h3><p>{["paid", "preparing_shipment"].includes(order.status) ? "Solo puedes cancelarla antes de enviar. Se bloqueará el envío y se solicitará a Stripe el reembolso completo." : "Puedes cancelar mientras el vestido no haya sido enviado."}</p><div className="field"><label>Motivo</label><textarea rows={3} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Explica brevemente por qué cancelas" /></div><button className="btn btn-secondary" disabled={busy || cancelReason.trim().length < 5} onClick={sellerCancel}>Cancelar venta</button></div>}
  </div>;
}
