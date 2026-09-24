export type NotificationNavigation = {
  kind: string;
  title?: string | null;
  body?: string | null;
  order_id?: string | null;
  dress_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DRAFT_KINDS = new Set(["draft_publication_help", "weekly_draft_reminder"]);

function safeInternalPath(value: unknown) {
  if (typeof value !== "string") return "";
  if (!/^\/[a-zA-Z0-9/_?=&.-]+$/.test(value) || value.startsWith("//")) return "";
  return value;
}

export function notificationHref(notification: NotificationNavigation) {
  const explicitPath = safeInternalPath(notification.metadata?.href_path);
  if (explicitPath) return explicitPath;

  if (notification.order_id) return `/pedidos/${encodeURIComponent(notification.order_id)}`;

  const conversationId = notification.metadata?.conversation_id;
  if (typeof conversationId === "string" && conversationId) {
    return `/mensajes?conversation=${encodeURIComponent(conversationId)}`;
  }

  if (notification.dress_id && (DRAFT_KINDS.has(notification.kind) || notification.kind === "dress_improvement_suggested")) {
    return `/publicar/${encodeURIComponent(notification.dress_id)}`;
  }

  if (notification.kind.startsWith("offer_")) return "/ofertas";
  if (notification.dress_id) return `/vestidos/${encodeURIComponent(notification.dress_id)}`;
  return "/";
}

export function notificationPresentation(notification: NotificationNavigation) {
  if (DRAFT_KINDS.has(notification.kind)) {
    return {
      title: "Tu vestido sigue en borrador",
      body: "Para vender más rápido, completa los campos obligatorios y selecciona “Publicar vestido”.",
      action: "Continuar publicación",
    };
  }

  const labels: Record<string, { title?: string; action: string }> = {
    offer_received: { title: "Tienes una nueva oferta", action: "Ver oferta" },
    offer_accepted: { title: "Tu oferta fue aceptada", action: "Ver pedido" },
    offer_cancelled: { action: "Ver conversación" },
    offer_expires_12h: { action: "Revisar oferta" },
    offer_expires_1h: { action: "Revisar oferta" },
    payment_confirmed: { title: "Pago confirmado: prepara el envío", action: "Ver pedido" },
    shipment_registered: { title: "Tu vestido ya fue enviado", action: "Seguir pedido" },
    claim_opened: { title: "La compradora abrió una reclamación", action: "Revisar y responder" },
    claim_seller_response: { action: "Ver reclamación" },
    claim_decision: { action: "Ver decisión" },
    return_label_ready: { action: "Ver guía de devolución" },
    refund_confirmed: { action: "Ver reembolso" },
    dress_improvement_suggested: { action: "Revisar publicación" },
  };
  const configured = labels[notification.kind];
  const orderKind = /^(payment|shipment|shipping|delivery|claim|return|refund|order|seller_|chargeback)/.test(notification.kind);
  const offerKind = notification.kind.startsWith("offer_");

  return {
    title: configured?.title || notification.title || "Tienes una actualización",
    body: notification.body || "Abre SECOND VOW para revisar los detalles.",
    action: configured?.action || (orderKind ? "Ver pedido" : offerKind ? "Ver oferta" : "Ver detalles"),
  };
}
