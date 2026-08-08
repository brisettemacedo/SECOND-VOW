"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CLAIM_REASONS = [
  ["wrong_item", "Recibí un artículo diferente"],
  ["counterfeit", "Posible falsificación"],
  ["damaged_undisclosed", "Daño relevante no declarado"],
  ["materially_not_as_described", "No coincide materialmente con la publicación"],
  ["undisclosed_alteration", "Alteración no informada"],
  ["measurements_materially_incorrect", "Medidas materialmente incorrectas"],
  ["missing_included_component", "Falta un componente anunciado"],
] as const;

export default function OrderActions({ order, userId }: { order: any; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function rpc(name: string, args: Record<string, any>) {
    setBusy(true);
    const { error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) alert(error.message); else router.refresh();
  }

  async function ship() {
    setBusy(true);
    const res = await fetch("/api/tracking/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, carrier, trackingNumber: tracking }),
    });
    const json = await res.json(); setBusy(false);
    if (!res.ok) alert(json.error || "No fue posible registrar el envío");
    else { if (json.warning) alert(json.warning); router.refresh(); }
  }

  async function checkout() {
    setBusy(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
    const json = await res.json(); setBusy(false);
    if (!res.ok) alert(json.error || "No fue posible iniciar el pago");
    else if (json.url) window.location.href = json.url;
  }

  async function delivered() {
    await rpc("confirm_order_delivered", { p_order_id: order.id });
  }

  async function acceptCondition() {
    await rpc("accept_order_condition", { p_order_id: order.id });
  }

  async function claim() {
    if (!reasonCode || !description.trim()) return;
    await rpc("open_order_claim", { p_order_id: order.id, p_reason_code: reasonCode, p_description: description.trim() });
  }

  return <div className="actions-stack">
    {order.buyer_id === userId && ["awaiting_payment","payment_processing"].includes(order.status) &&
      <div className="panel"><h3>Pago protegido</h3><p>El pago se procesa dentro de SECOND VOW. La vendedora no recibe el dinero hasta que termine el periodo de protección.</p><button className="btn btn-primary" disabled={busy} onClick={checkout}>Pagar de forma segura</button></div>}

    {order.seller_id === userId && ["paid", "preparing_shipment"].includes(order.status) &&
      <div className="panel">
        <h3>Registrar envío</h3>
        <p className="muted">Usa la paquetería de tu preferencia e ingresa el número de rastreo.</p>
        <div className="grid-2">
          <input placeholder="Paquetería" value={carrier} onChange={e => setCarrier(e.target.value)} />
          <input placeholder="Número de rastreo" value={tracking} onChange={e => setTracking(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy || !carrier.trim() || !tracking.trim()} onClick={ship}>Marcar enviado</button>
      </div>}

    {order.buyer_id === userId && order.status === "shipped" &&
      <button className="btn btn-primary" disabled={busy} onClick={delivered}>Confirmar recepción</button>}

    {order.buyer_id === userId && ["inspection", "delivered"].includes(order.status) &&
      <div className="panel">
        <h3>Revisa tu vestido</h3>
        <p>Tienes 72 horas desde la recepción registrada para reportar un incumplimiento sustancial.</p>
        {(order.dispute_deadline_at || order.inspection_deadline_at) && <p className="muted">Protección hasta: {new Date(order.dispute_deadline_at || order.inspection_deadline_at).toLocaleString("es-MX")}</p>}
        <hr />
        <h3>Abrir reclamación</h3>
        <div className="field"><label>Motivo</label><select value={reasonCode} onChange={e => setReasonCode(e.target.value)}><option value="">Selecciona</option>{CLAIM_REASONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label>Descripción</label><textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <button className="btn btn-secondary" disabled={busy || !reasonCode || !description.trim()} onClick={claim}>Abrir reclamación</button>
        <p className="muted">No aplica por cambio de opinión ni porque el vestido no quede si las medidas publicadas son correctas. Si se autoriza devolución, debe entregarse a paquetería dentro de 5 días naturales.</p>
      </div>}
  </div>;
}
