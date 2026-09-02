export const ORDER_STATUS: Record<string, string> = {
  awaiting_payment: "Pendiente de pago", payment_processing: "Procesando pago", payment_review: "Pago en revisión", chargeback_open: "Contracargo abierto",
  paid: "Pago confirmado", preparing_shipment: "Preparando envío", shipped: "Enviado", delivered: "Entregado", inspection: "Periodo de protección",
  claim_open: "Reclamación abierta", return_authorized: "Devolución autorizada", return_shipped: "Devolución en tránsito", returned: "Devolución recibida",
  refund_pending: "Reembolso pendiente", completed: "Completado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export type NextOrderAction = { label: string; cta?: string; href?: string; tone?: "attention" | "waiting" | "done" };

export function nextActionForOrder(order: any, userId: string): NextOrderAction {
  const seller = order.seller_id === userId;
  const buyer = order.buyer_id === userId;
  const href = `/pedidos/${order.id}`;
  if (["cancelled", "completed", "refunded"].includes(order.status)) return { label: ORDER_STATUS[order.status], tone: "done", href };
  if (order.status === "awaiting_payment" && seller && !order.shipping_quote_set_at) return { label: "Cotiza el envío", cta: "Cotizar", href, tone: "attention" };
  if (["awaiting_payment", "payment_processing"].includes(order.status) && buyer) return order.shipping_quote_set_at
    ? { label: "Completa el pago antes de que venza", cta: "Pagar", href, tone: "attention" }
    : { label: "Esperando que la vendedora cotice el envío", href, tone: "waiting" };
  if (["awaiting_payment", "payment_processing"].includes(order.status) && seller) return { label: "Esperando que la compradora pague", href, tone: "waiting" };
  if (["paid", "preparing_shipment"].includes(order.status) && seller) return { label: "Prepara y registra el envío", cta: "Registrar envío", href, tone: "attention" };
  if (["paid", "preparing_shipment"].includes(order.status) && buyer) return { label: "La vendedora está preparando el envío", href, tone: "waiting" };
  if (order.status === "shipped" && buyer) return { label: "Confirma la recepción cuando llegue", cta: "Ver seguimiento", href, tone: "attention" };
  if (["inspection", "delivered"].includes(order.status) && buyer) return { label: "Revisa el vestido dentro del periodo de protección", cta: "Revisar", href, tone: "attention" };
  return { label: ORDER_STATUS[order.status] || String(order.status).replaceAll("_", " "), href, tone: "waiting" };
}

export function orderBucket(order: any, userId: string): "attention" | "process" | "finished" {
  if (["cancelled", "completed", "refunded"].includes(order.status)) return "finished";
  return nextActionForOrder(order, userId).tone === "attention" ? "attention" : "process";
}

export function paymentTimeRemaining(deadline: string | null | undefined) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "El plazo de pago venció";
  const hours = Math.ceil(ms / 3_600_000);
  return hours === 1 ? "Queda 1 hora para pagar" : `Quedan ${hours} horas para pagar`;
}
