const PAYOUT_STATUS: Record<string, string> = {
  held: "Retenido", paused: "Pausado", releasable: "Disponible para retiro",
  requested: "Retiro solicitado", processing: "En proceso", paid: "Pagado",
  transferred: "Transferido", paid_out: "Retirado", reversed: "Reembolsado", failed: "Retiro pendiente de reintento",
};

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("es-MX")} MXN`;

export default function AdminOrderRecord({ order, payments, payouts }: {
  order: any; payments: any[]; payouts: any[]; ledger: any[]; events: any[]; adminLogs: any[];
}) {
  const payment = payments[0];
  const payout = payouts[0];
  const total = Number(payment?.amount_mxn ?? order.amount_charged_mxn ?? order.total_mxn ?? 0);
  const commission = Number(order.commission_mxn ?? 0);
  const ordinaryFee = Number(order.seller_admin_fee_mxn ?? 0);
  const sellerBalance = Number(payout?.transfer_amount_mxn ?? payout?.amount_mxn ?? order.seller_net_mxn ?? Math.max(0, total - commission - ordinaryFee));
  return <section className="panel">
    <h2>Estado del dinero</h2>
    <div className="admin-data-grid">
      <div className="admin-data-item"><span>Pago</span><strong>{payment?.status === "paid" ? "Pagado" : payment?.status === "refunded" ? "Reembolsado" : payment?.status === "partially_refunded" ? "Reembolso parcial" : "Pendiente"} · {money(total)}</strong></div>
      <div className="admin-data-item"><span>Saldo de la vendedora</span><strong>{PAYOUT_STATUS[payout?.status] || payout?.status || "Sin registro"} · {money(sellerBalance)}</strong></div>
      <div className="admin-data-item"><span>Comisión incluida</span><strong>{money(order.commission_mxn)}</strong></div>
    </div>
  </section>;
}
