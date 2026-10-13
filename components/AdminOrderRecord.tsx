import { orderMoneySummary } from "@/lib/orderLifecycle";

const PAYOUT_STATUS: Record<string, string> = {
  held: "Retenido", paused: "Pausado", releasable: "Disponible para retiro",
  requested: "Retiro solicitado", processing: "En proceso", paid: "Pagado",
  transferred: "Transferido", paid_out: "Retirado", reversed: "Transferencia revertida", failed: "Retiro pendiente de reintento",
};

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("es-MX")} MXN`;

export default function AdminOrderRecord({ order, payments, payouts, refunds = [], debts = [] }: {
  order: any; payments: any[]; payouts: any[]; refunds?: any[]; debts?: any[]; ledger: any[]; events: any[]; adminLogs: any[];
}) {
  const payout = payouts[0];
  const summary = orderMoneySummary(order, payments, payouts, refunds);
  return <section className="panel order-money-summary">
    <h2>Estado del dinero</h2>
    <div className="admin-data-grid">
      <div className="admin-data-item"><span>{summary.paid ? "Total pagado por la compradora" : "Total pendiente de pago"}</span><strong>{money(summary.total)}</strong></div>
      {(summary.refunded > 0 || summary.fullRefund) && <div className="admin-data-item"><span>Reembolso confirmado a la compradora</span><strong>{summary.refunded > 0 ? money(summary.refunded) : "Consulta la confirmación del reembolso"}</strong></div>}
      {summary.refundPending && <div className="admin-data-item"><span>Reembolso solicitado</span><strong>En proceso, falta confirmación</strong></div>}
      <div className="admin-data-item"><span>{summary.fullRefund ? "Saldo de esta venta para la vendedora" : "Saldo previsto para la vendedora"}</span><strong>{money(summary.sellerBalance)}{!summary.fullRefund && !summary.refundPending && payout && ` · ${PAYOUT_STATUS[payout.status] || payout.status}`}</strong></div>
      <div className="admin-data-item"><span>Comisión ordinaria{summary.fullRefund ? " de la venta cancelada" : " incluida"}</span><strong>{money(summary.commission)}</strong></div>
      {debts.map(debt => <div className="admin-data-item" key={debt.id}><span>Cargo separado a la vendedora, {debt.debt_type === "no_shipping" ? "falta de envío" : "incumplimiento documentado"}</span><strong>{money(debt.original_amount_mxn)} · pendiente {money(Math.max(0, Number(debt.original_amount_mxn) - Number(debt.recovered_amount_mxn ?? 0)))}</strong></div>)}
    </div>
    {summary.fullRefund && <p className="muted">El reembolso devuelve el pago a la compradora, no es un pago a la vendedora, esta venta no genera saldo ni comisión ordinaria.</p>}
    {summary.refundPending && <p className="muted">El dinero está bloqueado mientras se confirma el reembolso, no está disponible para retiro.</p>}
  </section>;
}
