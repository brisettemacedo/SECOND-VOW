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
  const activeClaim = (order.claims ?? []).find((item: any) => !["rejected", "closed", "refunded"].includes(item.status));
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [returnTracking, setReturnTracking] = useState(activeClaim?.return_tracking_number ?? "");
  const [returnCarrier, setReturnCarrier] = useState(activeClaim?.return_carrier ?? "");
  const [shippingAmount, setShippingAmount] = useState(order.shipping_quote_set_at ? String(order.shipping_mxn ?? 0) : "");
  const [shippingCarrier, setShippingCarrier] = useState(order.shipping_carrier_declared ?? "");
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [sellerResponse, setSellerResponse] = useState(activeClaim?.seller_response ?? "");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [checkoutTerms, setCheckoutTerms] = useState(false);
  const [chargeAcknowledged, setChargeAcknowledged] = useState(false);
  const [insured, setInsured] = useState(Boolean(order.shipping_insurance_confirmed));
  const [signature, setSignature] = useState(Boolean(order.shipping_signature_confirmed));
  const [idDelivery, setIdDelivery] = useState(false);
  const [sellerEvidenceRetained, setSellerEvidenceRetained] = useState(false);
  const [buyerEvidenceRetained, setBuyerEvidenceRetained] = useState(false);
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
    const res = await fetch("/api/tracking/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, carrier, trackingNumber: tracking, insured, signature, idDelivery, evidenceRetained: sellerEvidenceRetained }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) alert(json.error || "No fue posible registrar el envío"); else { if (json.warning) alert(json.warning); router.refresh(); }
  }
  async function claim() {
    if (reasonCode && description.trim().length >= 20) await rpc("open_order_claim", { p_order_id: order.id, p_reason_code: reasonCode, p_description: description.trim() });
  }
  async function respondToClaim() {
    if (activeClaim?.id && sellerResponse.trim().length >= 20) await rpc("seller_respond_to_claim", { p_claim_id: activeClaim.id, p_response: sellerResponse.trim() });
  }
  async function provideReturnLabel() {
    if (activeClaim?.id && returnCarrier.trim() && returnTracking.trim()) await rpc("seller_provide_return_label", { p_claim_id: activeClaim.id, p_carrier: returnCarrier.trim(), p_tracking_number: returnTracking.trim() });
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
  const resolution = activeClaim?.claim_resolutions?.[0];
  return <div className="actions-stack">
    {actionError && <div className="alert-error"><strong>{failedAction === "cancellation" ? "No se pudo cancelar la venta." : failedAction === "return" ? "No se pudo registrar la devolución." : "No se pudo iniciar el pago."}</strong><p>{actionError}</p></div>}
    {["awaiting_payment", "payment_processing"].includes(order.status) && order.payment_deadline_at && <div className="protection-deadline"><span>Plazo de pago</span><strong>{paymentTimeRemaining(order.payment_deadline_at)}</strong><span>El vestido sigue visible hasta que se confirme un pago.</span></div>}
    <div className="safety-callout"><strong>Seguridad de la operación</strong><span>Mantén pagos, acuerdos y evidencia dentro de SECOND VOW. La evidencia del estado, empaque, envío y recepción puede ser determinante.</span></div>

    {order.seller_id === userId && order.status === "awaiting_payment" && !order.offer_id && <div className="panel"><h3>Cotizar envío de pedido anterior</h3><p>Este pedido no nació de una oferta con envío fijo. Captura el costo antes del pago.</p><div className="grid-2"><div className="field"><label>Costo de envío (MXN)</label><input type="number" min={0} value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} /></div><div className="field"><label>Paquetería estimada</label><input value={shippingCarrier} onChange={(e) => setShippingCarrier(e.target.value)} /></div></div><button className="btn btn-primary" disabled={busy || shippingAmount === ""} onClick={quoteShipping}>{order.shipping_quote_set_at ? "Actualizar cotización" : "Enviar cotización"}</button></div>}

    {order.buyer_id === userId && ["awaiting_payment", "payment_processing"].includes(order.status) && <div className="panel"><h3>Pago dentro de SECOND VOW</h3><p>No realices transferencias directas. El cargo aparecerá identificado como SECOND VOW.</p>{order.shipping_quote_set_at ? <><p><strong>Vestido:</strong> ${Number(order.subtotal_mxn).toLocaleString("es-MX")} MXN<br/><strong>Envío fijo:</strong> ${Number(order.shipping_mxn).toLocaleString("es-MX")} MXN<br/><strong>Total:</strong> ${Number(order.total_mxn).toLocaleString("es-MX")} MXN</p><div className="legal-checks"><label className="check"><input type="checkbox" checked={checkoutTerms} onChange={(e) => setCheckoutTerms(e.target.checked)} /><span>Acepto los <Link href="/legal/terminos" target="_blank">Términos</Link>, la <Link href="/legal/devoluciones" target="_blank">Política de reclamaciones</Link> y el plazo de 48 horas para reportar falta de recepción, información materialmente incorrecta o daño relevante no informado.</span></label><label className="check"><input type="checkbox" checked={deliveryAcknowledged} onChange={(e) => setDeliveryAcknowledged(e.target.checked)} /><span>Entiendo que el paquete se entregará contra identificación oficial y firma a la persona indicada en el destino. Me comprometo a conservar fotografías y video del paquete cerrado, su apertura y el estado del vestido.</span></label><label className="check"><input type="checkbox" checked={chargeAcknowledged} onChange={(e) => setChargeAcknowledged(e.target.checked)} /><span>Reconozco el importe, el vestido, el destino de envío y que el cargo bancario será identificado como SECOND VOW.</span></label></div><button className="btn btn-primary" disabled={busy || !checkoutTerms || !chargeAcknowledged || !deliveryAcknowledged} onClick={checkout}>Pagar de forma segura</button></> : <div className="alert-info">Esperando la cotización de envío.</div>}</div>}

    {order.seller_id === userId && ["paid", "preparing_shipment"].includes(order.status) && !order.shipping_blocked_at && <div className="panel"><h3>Registrar guía y envío</h3><p>Tienes cinco días naturales desde el pago. El envío debe estar asegurado y entregarse contra identificación oficial y firma.</p><div className="evidence-guidance"><strong>Conserva tu evidencia; no necesitas subirla ahora.</strong><ol><li>Fotografías del vestido antes de empacarlo.</li><li>Fotografías o video del paquete cerrado.</li><li>Comprobante de recepción de la paquetería.</li><li>Conserva los originales hasta que la operación concluya. SECOND VOW podrá solicitarlos si existe una controversia.</li></ol></div><div className="grid-2"><input placeholder="Paquetería reconocida" value={carrier} onChange={(e) => setCarrier(e.target.value)} /><input placeholder="Número de guía o rastreo" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div><div className="legal-checks"><label className="check"><input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} /><span>Confirmo que contraté seguro de envío.</span></label><label className="check"><input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} /><span>Confirmo que contraté firma de recepción.</span></label><label className="check"><input type="checkbox" checked={idDelivery} onChange={(e) => setIdDelivery(e.target.checked)} /><span>Confirmo que contraté entrega contra identificación oficial y que la guía corresponde exactamente al destino del pedido.</span></label><label className="check"><input type="checkbox" checked={sellerEvidenceRetained} onChange={(e) => setSellerEvidenceRetained(e.target.checked)} /><span>Confirmo que conservé evidencia del vestido, paquete cerrado y comprobante de paquetería, y que podré entregarla si existe una controversia.</span></label></div><button className="btn btn-primary" disabled={busy || !carrier.trim() || !tracking.trim() || !insured || !signature || !idDelivery || !sellerEvidenceRetained} onClick={ship}>Compartir guía y comenzar seguimiento</button></div>}

    {order.buyer_id === userId && order.status === "shipped" && <div className="panel"><h3>Cuando recibas el paquete</h3><ol><li>Muestra identificación oficial y firma únicamente a la paquetería.</li><li>Fotografía todos los lados, etiqueta, golpes o aberturas antes de abrir.</li><li>Graba un video continuo desde el paquete cerrado hasta revisar el vestido.</li><li>Fotografía vestido, etiquetas, accesorios y cualquier diferencia.</li><li>Conserva el empaque durante las 48 horas de protección.</li><li>No laves, alteres, repares ni uses el vestido antes de concluir la revisión.</li></ol><p className="muted">No tienes que subir estos archivos salvo que abras una reclamación.</p><label className="check"><input type="checkbox" checked={buyerEvidenceRetained} onChange={(e) => setBuyerEvidenceRetained(e.target.checked)} /><span>Confirmo que documenté y conservé la recepción y apertura del paquete.</span></label><button className="btn btn-primary" disabled={busy || !buyerEvidenceRetained} onClick={() => rpc("confirm_order_delivered", { p_order_id: order.id })}>Confirmar recepción</button></div>}

    {order.buyer_id === userId && ["inspection", "delivered"].includes(order.status) && <div className="panel claim-open-panel"><h3>¿Hay un problema con tu pedido?</h3><p>Solo abre una reclamación si no recibiste el paquete, el vestido no coincide materialmente con la publicación o tiene un daño relevante que no fue informado. No procede por talla, ajuste o cambio de opinión.</p>{deadline && <div className="protection-deadline"><span>Plazo para reportar</span><strong>{new Date(deadline).toLocaleString("es-MX")}</strong></div>}<div className="claim-process"><span><strong>1</strong> Explica qué ocurrió</span><span><strong>2</strong> La vendedora responde</span><span><strong>3</strong> SECOND VOW revisa</span></div><div className="field"><label>¿Qué ocurrió?</label><select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}><option value="">Selecciona una opción</option>{CLAIM_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>Cuéntanos los hechos con claridad</label><textarea rows={5} minLength={20} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué esperabas recibir, qué recibiste y cuándo lo notaste" /><small>Mínimo 20 caracteres. Podrás agregar fotos o video después, si los tienes.</small></div><div className="alert-info"><strong>¿Qué ocurre al enviarla?</strong><p>El saldo de la vendedora se congela, ella recibe una notificación y puede responder dentro de tres días. Abrir la reclamación no autoriza automáticamente una devolución o reembolso.</p></div><button className="btn btn-secondary" disabled={busy || !reasonCode || description.trim().length < 20} onClick={claim}>Enviar reclamación para revisión</button></div>}

    {order.buyer_id === userId && activeClaim && order.status === "claim_open" && <div className="panel"><h3>Tu reclamación está en revisión</h3><p>La vendedora puede responder hasta {activeClaim.seller_response_due_at ? new Date(activeClaim.seller_response_due_at).toLocaleString("es-MX") : "la fecha indicada"}. Te notificaremos cuando responda y cuando exista una decisión.</p><h4>¿Tienes fotos o video?</h4><p>Adjuntarlos es opcional, pero puede ayudar a acreditar lo sucedido. Conserva también los archivos originales.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_dress_received" existing={evidence.filter((x: any) => x.evidence_type === "buyer_dress_received")} /></div>}

    {order.seller_id === userId && activeClaim && order.status === "claim_open" && <div className="panel claim-response-panel"><h3>La compradora abrió una reclamación</h3><p><strong>Motivo:</strong> {CLAIM_REASONS.find(([value]) => value === (activeClaim.reason_code ?? activeClaim.reason))?.[1] ?? activeClaim.reason}</p><blockquote>{activeClaim.description}</blockquote>{activeClaim.seller_response ? <div className="alert-info"><strong>Tu respuesta quedó registrada</strong><p>{activeClaim.seller_response}</p></div> : <><p>Explica tu versión antes del {activeClaim.seller_response_due_at ? new Date(activeClaim.seller_response_due_at).toLocaleString("es-MX") : "plazo indicado"}. SECOND VOW revisará ambas versiones antes de decidir.</p><div className="field"><label>Tu respuesta</label><textarea rows={5} minLength={20} maxLength={2000} value={sellerResponse} onChange={(event) => setSellerResponse(event.target.value)} placeholder="Describe el estado informado, el embalaje, envío y cualquier dato relevante" /><small>Mínimo 20 caracteres.</small></div><h4>¿Tienes evidencia?</h4><p>Es opcional. Puedes adjuntar fotografías, comprobantes o video si ayudan a respaldar tu respuesta.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_claim_response" existing={evidence.filter((x: any) => x.evidence_type === "seller_claim_response")} /><button className="btn btn-primary" disabled={busy || sellerResponse.trim().length < 20} onClick={respondToClaim}>Enviar mi respuesta</button></>}</div>}

    {order.seller_id === userId && order.status === "return_authorized" && activeClaim?.status === "approved_return" && resolution?.liability === "seller" && <div className="panel"><h3>Proporciona la guía prepagada de devolución</h3><p>Como la devolución fue atribuida a la vendedora, debes pagar la guía y compartirla antes del {activeClaim.return_label_deadline_at ? new Date(activeClaim.return_label_deadline_at).toLocaleString("es-MX") : "plazo indicado"}. La compradora no debe adelantar este gasto.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_return_label" existing={evidence.filter((x: any) => x.evidence_type === "seller_return_label")} showFiles /><div className="grid-2"><input placeholder="Paquetería" value={returnCarrier} onChange={(e) => setReturnCarrier(e.target.value)} /><input placeholder="Número de guía prepagada" value={returnTracking} onChange={(e) => setReturnTracking(e.target.value)} /></div><button className="btn btn-primary" disabled={busy || !returnCarrier.trim() || !returnTracking.trim() || !evidence.some((x: any) => x.evidence_type === "seller_return_label")} onClick={provideReturnLabel}>Compartir guía prepagada</button></div>}

    {order.buyer_id === userId && order.status === "return_authorized" && activeClaim?.status === "approved_return" && <div className="panel"><h3>Enviar devolución autorizada</h3>{resolution?.liability === "seller" && !activeClaim.return_tracking_number ? <div className="alert-info"><strong>Esperando guía prepagada</strong><p>La vendedora debe pagar y compartir la guía. No compres una guía por tu cuenta.</p></div> : <><p>Empaca el vestido en el estado recibido. La evidencia es opcional, pero consérvala si la tienes.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_return_packed" existing={evidence.filter((x: any) => x.evidence_type === "buyer_return_packed")} />{resolution?.liability === "seller" ? <div className="alert-info"><strong>Guía prepagada disponible</strong><p>{activeClaim.return_carrier} · {activeClaim.return_tracking_number}</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_return_label" existing={evidence.filter((x: any) => x.evidence_type === "seller_return_label")} showFiles readOnly /></div> : <div className="grid-2"><input placeholder="Paquetería" value={returnCarrier} onChange={(e) => setReturnCarrier(e.target.value)} /><input placeholder="Número de guía" value={returnTracking} onChange={(e) => setReturnTracking(e.target.value)} /></div>}<p>Entrega el paquete antes de {activeClaim.return_shipping_deadline_at ? new Date(activeClaim.return_shipping_deadline_at).toLocaleString("es-MX") : "la fecha indicada"}.</p><button className="btn btn-primary" disabled={busy || !returnCarrier.trim() || !returnTracking.trim()} onClick={registerReturn}>Confirmar entrega a paquetería</button></>}</div>}

    {order.seller_id === userId && order.status === "return_shipped" && <div className="panel"><h3>Devolución en tránsito</h3><p>Cuando recibas el vestido, revisa y conserva evidencia. La confirmación habilita el reembolso administrativo.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_return_received" existing={evidence.filter((x: any) => x.evidence_type === "seller_return_received")} /><button className="btn btn-primary" disabled={busy} onClick={() => rpc("confirm_return_received", { p_order_id: order.id })}>Confirmar devolución recibida</button></div>}

    {order.status === "returned" && <div className="alert-info">La devolución fue recibida. SECOND VOW debe completar el reembolso al medio de pago original.</div>}
    {order.status === "payment_review" && <div className="alert-error">El pago requiere conciliación manual. No envíes el vestido hasta que administración resuelva el caso.</div>}
    {order.status === "chargeback_open" && <div className="alert-error"><strong>NO ENVÍES.</strong> La compradora desconoció el cargo y Stripe abrió un contracargo. El envío y el retiro están bloqueados.</div>}
    {order.seller_id === userId && ["awaiting_payment", "payment_processing", "paid", "preparing_shipment"].includes(order.status) && !order.shipped_at && <div className="panel"><h3>Cancelar venta</h3><p>{["paid", "preparing_shipment"].includes(order.status) ? "Solo puedes cancelarla antes de enviar. Se bloqueará el envío y se solicitará a Stripe el reembolso completo." : "Puedes cancelar mientras el vestido no haya sido enviado."}</p><div className="field"><label>Motivo</label><textarea rows={3} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Explica brevemente por qué cancelas" /></div><button className="btn btn-secondary" disabled={busy || cancelReason.trim().length < 5} onClick={sellerCancel}>Cancelar venta</button></div>}
  </div>;
}
