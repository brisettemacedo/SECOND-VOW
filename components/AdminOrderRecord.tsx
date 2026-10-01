const PAYOUT_STATUS: Record<string, string> = {
  held: "Retenido", paused: "Pausado", releasable: "Disponible para retiro",
  requested: "Retiro solicitado", processing: "En proceso", paid: "Pagado",
  transferred: "Transferido", paid_out: "Retirado", reversed: "Reembolsado", failed: "Retiro pendiente de reintento",
};

const EVENT_LABELS: Record<string, string> = {
  claim_opened: "Reclamación abierta", claim_decided: "Reclamación resuelta",
  claim_appealed: "Revisión solicitada", delivery_confirmed: "Entrega confirmada",
  shipped: "Guía registrada", id_delivery_acknowledged: "Entrega con identificación aceptada",
  checkout_terms_accepted: "Términos de compra aceptados", seller_terms_accepted: "Términos de venta aceptados",
};

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("es-MX")} MXN`;
const date = (value: string) => new Date(value).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });

export default function AdminOrderRecord({ order, payments, payouts, ledger, events, adminLogs }: {
  order: any; payments: any[]; payouts: any[]; ledger: any[]; events: any[]; adminLogs: any[];
}) {
  const payment = payments[0];
  const payout = payouts[0];
  const total = Number(payment?.amount_mxn ?? order.amount_charged_mxn ?? order.total_mxn ?? 0);
  const commission = Number(order.commission_mxn ?? 0);
  const ordinaryFee = Number(order.seller_admin_fee_mxn ?? 0);
  const debtOffset = Number(payout?.debt_offset_mxn ?? 0);
  const sellerBalance = Number(payout?.transfer_amount_mxn ?? payout?.amount_mxn ?? order.seller_net_mxn ?? Math.max(0, total - commission - ordinaryFee));
  const refunds = ledger.filter(entry => entry.entry_type === "refund");
  const nonshipmentCharge = ledger.filter(entry => entry.entry_type === "seller_nonshipment_charge").reduce((sum, entry) => sum + Number(entry.amount_mxn || 0), 0);
  return <section className="panel">
    <h2>Estado del dinero</h2>
    <div className="admin-data-grid">
      <div className="admin-data-item"><span>Pago</span><strong>{payment?.status === "paid" ? "Pagado" : payment?.status === "refunded" ? "Reembolsado" : payment?.status === "partially_refunded" ? "Reembolso parcial" : "Pendiente"} · {money(total)}</strong></div>
      <div className="admin-data-item"><span>Saldo de la vendedora</span><strong>{PAYOUT_STATUS[payout?.status] || payout?.status || "Sin registro"} · {money(sellerBalance)}</strong></div>
      <div className="admin-data-item"><span>Comisión incluida</span><strong>{money(order.commission_mxn)}</strong></div>
    </div>
    <details open><summary>Desglose del pago</summary>
      <div className="order-price-lines">
        <div><span>Vestido</span><strong>{money(order.subtotal_mxn)}</strong></div>
        <div><span>Envío</span><strong>{money(order.shipping_mxn)}</strong></div>
        <div className="order-total"><span>Total cobrado</span><strong>{money(total)}</strong></div>
        <div><span>Comisión, incluye procesamiento del pago</span><strong>{money(commission)}</strong></div>
        {ordinaryFee > 0 && <div><span>Otros cargos de la operación</span><strong>{money(ordinaryFee)}</strong></div>}
        {debtOffset > 0 && <div><span>Descuento de adeudos anteriores</span><strong>{money(debtOffset)}</strong></div>}
        <div className="order-total"><span>{["refunded", "cancelled"].includes(order.status) ? "Saldo para la vendedora" : "Saldo después de descuentos"}</span><strong>{money(["refunded", "cancelled"].includes(order.status) ? 0 : sellerBalance)}</strong></div>
      </div>
      {refunds.map(entry => <p key={entry.id}>Reembolso a la compradora, {date(entry.created_at)}: {money(Math.abs(entry.amount_mxn))}</p>)}
      {nonshipmentCharge > 0 && <p>Cargo administrativo por falta de envío (4%): {money(nonshipmentCharge)}, se descontará de la siguiente venta concluida</p>}
    </details>
    <details><summary>Actividad del pedido ({events.length + adminLogs.length})</summary>
      <ul>{events.map((event) => <li key={event.id}>{date(event.created_at)} · {EVENT_LABELS[event.event_type] || String(event.event_type).replaceAll("_", " ")}</li>)}{adminLogs.map((log) => <li key={log.id}>{date(log.created_at)} · {String(log.action).replaceAll("_", " ")}{log.reason ? `: ${log.reason}` : ""}</li>)}</ul>
    </details>
    <details><summary>Referencias para soporte</summary>
      <p>Referencia de pago: {order.stripe_payment_intent_id || "Sin registro"}<br />Sesión de pago: {order.stripe_checkout_session_id || "Sin registro"}<br />Cargo: {order.stripe_charge_id || "Sin registro"}<br />Términos aceptados: {order.checkout_terms_version || "Sin registro"}</p>
    </details>
  </section>;
}
