"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OrderEvidenceUploader from "@/components/OrderEvidenceUploader";

const CLAIM_REASONS = [["wrong_item", "Recibí un artículo diferente"], ["counterfeit", "Posible falsificación"], ["damaged_undisclosed", "Daño relevante no declarado"], ["materially_not_as_described", "No coincide materialmente con la publicación"], ["undisclosed_alteration", "Alteración no informada"], ["measurements_materially_incorrect", "Medidas materialmente incorrectas"], ["missing_included_component", "Falta un componente anunciado"]] as const;

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
    setBusy(true); setActionError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `No fue posible iniciar el pago (${res.status})`);
      if (!json.url) throw new Error("Stripe no devolvió la página de pago.");
      window.location.assign(json.url);
    } catch (error: any) { setActionError(error?.message || "No fue posible iniciar el pago"); }
    finally { setBusy(false); }
  }
  async function ship() {
    setBusy(true);
    const res = await fetch("/api/tracking/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, carrier, trackingNumber: tracking }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) alert(json.error || "No fue posible registrar el envío"); else { if (json.warning) alert(json.warning); router.refresh(); }
  }
  async function claim() {
    if (reasonCode && description.trim()) await rpc("open_order_claim", { p_order_id: order.id, p_reason_code: reasonCode, p_description: description.trim() });
  }
  async function registerReturn() {
    await rpc("register_return_shipment", { p_order_id: order.id, p_carrier: returnCarrier.trim(), p_tracking_number: returnTracking.trim() });
  }

  const deadline = order.dispute_deadline_at || order.inspection_deadline_at || order.claim_deadline_at;
  const activeClaim = (order.claims ?? []).find((item: any) => !["rejected", "closed", "refunded"].includes(item.status));
  return <div className="actions-stack">
    {actionError && <div className="alert-error"><strong>No se pudo iniciar el pago.</strong><p>{actionError}</p>{actionError.toLowerCase().includes("vendedora") && <p>La vendedora debe entrar a Cuenta → Pagos y retiros y completar Stripe Connect.</p>}</div>}
    <div className="safety-callout"><strong>Seguridad de la operación</strong><span>Mantén pagos, acuerdos y evidencia dentro de SECOND VOW. La evidencia del estado, empaque, envío y recepción puede ser determinante.</span></div>

    {order.seller_id === userId && order.status === "awaiting_payment" && <div className="panel"><h3>Cotizar envío</h3><p>Consulta la paquetería y captura el costo. La compradora pagará vestido y envío dentro de SECOND VOW.</p><div className="grid-2"><div className="field"><label>Costo de envío (MXN)</label><input type="number" min={0} value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} /></div><div className="field"><label>Paquetería estimada</label><input value={shippingCarrier} onChange={(e) => setShippingCarrier(e.target.value)} /></div></div><button className="btn btn-primary" disabled={busy || shippingAmount === ""} onClick={quoteShipping}>{order.shipping_quote_set_at ? "Actualizar cotización" : "Enviar cotización"}</button></div>}

    {order.buyer_id === userId && ["awaiting_payment", "payment_processing"].includes(order.status) && <div className="panel"><h3>Pago dentro de SECOND VOW</h3><p>No realices transferencias directas. La sesión de pago reserva temporalmente el vestido y puede reutilizarse si haces doble clic.</p>{order.shipping_quote_set_at ? <><p><strong>Envío:</strong> ${Number(order.shipping_mxn).toLocaleString("es-MX")} MXN</p><button className="btn btn-primary" disabled={busy} onClick={checkout}>Pagar de forma segura</button></> : <div className="alert-info">Esperando la cotización de envío.</div>}</div>}

    {order.seller_id === userId && ["paid", "preparing_shipment"].includes(order.status) && <div className="panel"><h3>Prepara y documenta el envío</h3><div className="evidence-guidance"><ol><li>Fotografía el vestido completo y detalles.</li><li>Fotografía el empaque abierto y cerrado.</li><li>Conserva el comprobante.</li><li>Usa rastreo y considera seguro.</li></ol></div><div className="evidence-grid"><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_pre_ship" existing={evidence.filter((x: any) => x.evidence_type === "seller_pre_ship")} /><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_packed" existing={evidence.filter((x: any) => x.evidence_type === "seller_packed")} /><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_shipping_receipt" existing={evidence.filter((x: any) => x.evidence_type === "seller_shipping_receipt")} /></div><h3>Registrar guía</h3><div className="grid-2"><input placeholder="Paquetería" value={carrier} onChange={(e) => setCarrier(e.target.value)} /><input placeholder="Número de rastreo" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div><button className="btn btn-primary" disabled={busy || !carrier.trim() || !tracking.trim()} onClick={ship}>Registrar envío</button></div>}

    {order.buyer_id === userId && order.status === "shipped" && <div className="panel"><h3>Cuando recibas el paquete</h3><p>Fotografía el paquete antes de abrirlo y graba la apertura.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_package_received" existing={evidence.filter((x: any) => x.evidence_type === "buyer_package_received")} /><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_unboxing" existing={evidence.filter((x: any) => x.evidence_type === "buyer_unboxing")} /><button className="btn btn-primary" disabled={busy} onClick={() => rpc("confirm_order_delivered", { p_order_id: order.id })}>Confirmar recepción</button></div>}

    {order.buyer_id === userId && ["inspection", "delivered"].includes(order.status) && <div className="panel"><h3>Revisa tu vestido</h3><p>El plazo para reportar incumplimiento sustancial es de 72 horas desde la recepción registrada.</p>{deadline && <div className="protection-deadline"><span>Protección hasta</span><strong>{new Date(deadline).toLocaleString("es-MX")}</strong></div>}<OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_dress_received" existing={evidence.filter((x: any) => x.evidence_type === "buyer_dress_received")} /><hr /><h3>Abrir reclamación</h3><div className="field"><label>Motivo</label><select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}><option value="">Selecciona</option>{CLAIM_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>Descripción</label><textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div><button className="btn btn-secondary" disabled={busy || !reasonCode || !description.trim()} onClick={claim}>Abrir reclamación</button></div>}

    {order.buyer_id === userId && order.status === "return_authorized" && activeClaim?.status === "approved_return" && <div className="panel"><h3>Enviar devolución</h3><p>Entrega el vestido a paquetería antes de {activeClaim.return_shipping_deadline_at ? new Date(activeClaim.return_shipping_deadline_at).toLocaleString("es-MX") : "la fecha indicada"}. Usa rastreo y conserva evidencia.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="buyer_return_packed" existing={evidence.filter((x: any) => x.evidence_type === "buyer_return_packed")} /><div className="grid-2"><input placeholder="Paquetería" value={returnCarrier} onChange={(e) => setReturnCarrier(e.target.value)} /><input placeholder="Número de guía" value={returnTracking} onChange={(e) => setReturnTracking(e.target.value)} /></div><button className="btn btn-primary" disabled={busy || !returnCarrier.trim() || !returnTracking.trim()} onClick={registerReturn}>Registrar devolución</button></div>}

    {order.seller_id === userId && order.status === "return_shipped" && <div className="panel"><h3>Devolución en tránsito</h3><p>Cuando recibas el vestido, revisa y conserva evidencia. La confirmación habilita el reembolso administrativo.</p><OrderEvidenceUploader orderId={order.id} userId={userId} stage="seller_return_received" existing={evidence.filter((x: any) => x.evidence_type === "seller_return_received")} /><button className="btn btn-primary" disabled={busy} onClick={() => rpc("confirm_return_received", { p_order_id: order.id })}>Confirmar devolución recibida</button></div>}

    {order.status === "returned" && <div className="alert-info">La devolución fue recibida. SECOND VOW debe completar el reembolso al medio de pago original.</div>}
    {order.status === "payment_review" && <div className="alert-error">El pago requiere conciliación manual. No envíes el vestido hasta que administración resuelva el caso.</div>}
  </div>;
}
