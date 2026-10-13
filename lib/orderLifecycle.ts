export function orderQuickReplies(order: any, buyer: boolean, hasDestination: boolean) {
  const status = order?.status;
  if (!status) return buyer
    ? ["¿Sigue disponible?", "¿Puedes confirmar las medidas?", "Quiero recibir una oferta final"]
    : hasDestination ? ["Estoy cotizando tu envío", "Te envío la oferta en breve"] : ["Sí, sigue disponible", "Comparte la sucursal donde quieres recibir el vestido para cotizar el envío"];
  if (["refunded", "cancelled", "completed"].includes(status)) return [];
  if (["awaiting_payment", "payment_processing"].includes(status)) return buyer ? ["Voy a completar el pago", "Necesito ayuda con el pago"] : ["La oferta incluye el envío, quedo pendiente del pago"];
  if (["paid", "preparing_shipment"].includes(status)) return buyer ? ["¿Cuándo entregarás el vestido a la paquetería?"] : ["Estoy preparando tu paquete", "Compartiré la guía desde el pedido"];
  if (status === "shipped") return buyer ? ["Estoy pendiente del rastreo"] : ["Puedes consultar el rastreo en el pedido"];
  if (["inspection", "delivered"].includes(status)) return ["Estoy revisando la recepción del vestido"];
  if (["claim_open", "return_authorized", "return_shipped", "returned", "refund_pending"].includes(status)) return ["Revisemos la reclamación desde el pedido"];
  return [];
}

export function orderMoneySummary(order: any, payments: any[] = [], payouts: any[] = [], refunds: any[] = []) {
  const payment = payments.find(p => ["paid", "refunded", "partially_refunded"].includes(p.status)) ?? payments[0];
  const total = Number(payment?.amount_mxn ?? order.amount_charged_mxn ?? order.total_mxn ?? 0);
  const refunded = Math.min(total, refunds.filter(r => r.status === "succeeded").reduce((sum, r) => sum + Number(r.amount_mxn ?? 0), 0));
  const fullRefund = order.status === "refunded" || (total > 0 && refunded >= total);
  const refundPending = order.status === "refund_pending" || refunds.some(r => r.status === "processing");
  const paid = Boolean(order.paid_at || payment || fullRefund);
  return {
    total, paid, refunded, fullRefund, refundPending,
    commission: fullRefund ? 0 : Number(order.commission_mxn ?? 0),
    sellerBalance: fullRefund || refundPending ? 0 : Number(payouts[0]?.transfer_amount_mxn ?? payouts[0]?.amount_mxn ?? order.seller_net_mxn ?? 0),
  };
}

export const CHAT_ORDER_EVENT_LABELS: Record<string, string> = {
  shipping_deadline_expired: "Venta cancelada por falta de envío, reembolso solicitado",
  claim_opened: "Reclamación abierta, saldo retenido",
  claim_decided: "Decisión sobre la reclamación registrada",
  claim_appealed: "Revisión de la decisión solicitada",
  return_label_provided: "Guía de devolución compartida",
  return_shipped: "Devolución en tránsito",
  return_received: "Devolución recibida, reembolso pendiente",
  refund_pending: "Reembolso pendiente de confirmación",
  order_completed: "Venta concretada, revisión concluida",
};
