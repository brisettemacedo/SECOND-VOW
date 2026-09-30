const PAYOUT_STATUS: Record<string, string> = {
  held: "Retenido", paused: "Pausado", releasable: "Disponible para retiro",
  requested: "Retiro solicitado", processing: "En proceso", paid: "Pagado",
  transferred: "Transferido", failed: "Falló",
};

const EVENT_LABELS: Record<string, string> = {
  claim_opened: "Reclamación abierta", claim_decided: "Reclamación resuelta",
  claim_appealed: "Revisión solicitada", delivery_confirmed: "Entrega confirmada",
  shipped: "Guía registrada", id_delivery_acknowledged: "Entrega con identificación aceptada",
};

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("es-MX")} MXN`;
const date = (value: string) => new Date(value).toLocaleString("es-MX");

export default function AdminOrderRecord({ order, payments, payouts, ledger, events, adminLogs }: {
  order: any; payments: any[]; payouts: any[]; ledger: any[]; events: any[]; adminLogs: any[];
}) {
  const payment = payments[0];
  const payout = payouts[0];
  return <section className="panel">
    <h2>Estado del dinero</h2>
    <div className="admin-data-grid">
      <div className="admin-data-item"><span>Pago</span><strong>{payment?.status === "paid" ? "Pagado" : payment?.status || "Sin registro"} · {money(payment?.amount_mxn)}</strong></div>
      <div className="admin-data-item"><span>Saldo de la vendedora</span><strong>{PAYOUT_STATUS[payout?.status] || payout?.status || "Sin registro"} · {money(payout?.amount_mxn)}</strong></div>
      <div className="admin-data-item"><span>Comisión SECOND VOW</span><strong>{money(order.commission_mxn)}</strong></div>
      <div className="admin-data-item"><span>Costo Stripe</span><strong>{money(order.processor_fee_mxn)}</strong></div>
    </div>
    <details><summary>Movimientos ({ledger.length})</summary>
      {ledger.length ? <ul>{ledger.map((entry) => <li key={entry.id}>{date(entry.created_at)} · {String(entry.entry_type).replaceAll("_", " ")} · {money(entry.amount_mxn)}</li>)}</ul> : <p>No hay movimientos registrados.</p>}
    </details>
    <details><summary>Actividad del pedido ({events.length + adminLogs.length})</summary>
      <ul>{events.map((event) => <li key={event.id}>{date(event.created_at)} · {EVENT_LABELS[event.event_type] || String(event.event_type).replaceAll("_", " ")}</li>)}{adminLogs.map((log) => <li key={log.id}>{date(log.created_at)} · {String(log.action).replaceAll("_", " ")}{log.reason ? `: ${log.reason}` : ""}</li>)}</ul>
    </details>
    <details><summary>Referencias para soporte</summary>
      <p>Pago Stripe: {order.stripe_payment_intent_id || "Sin registro"}<br />Checkout: {order.stripe_checkout_session_id || "Sin registro"}<br />Cargo: {order.stripe_charge_id || "Sin registro"}<br />Términos aceptados: {order.checkout_terms_version || "Sin registro"}</p>
    </details>
  </section>;
}
