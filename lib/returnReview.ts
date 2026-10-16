/** A tracking number or seller receipt never authorizes a monetary refund. */
export function returnRefundBlock(claim: any, resolution: any, order: any, now = Date.now()): string | null {
  if (!claim || !["returned", "refund_pending"].includes(claim.status)) return "La devolución todavía está en revisión";
  if (!claim.return_reviewed_at || !claim.return_reviewed_by || !claim.return_tracking_number) return "SECOND VOW debe verificar el retorno y documentar la solución antes del reembolso";
  if (!resolution || resolution.decision !== "authorize_return") return "Falta una resolución administrativa motivada";
  if (resolution.status === "appealed") return "La resolución está en revisión, el dinero permanece retenido";
  const deadline = Date.parse(resolution.appeal_deadline_at ?? "");
  if (resolution.status !== "final" && (!Number.isFinite(deadline) || deadline > now)) return "El plazo de revisión de tres días aún no concluye";
  if (!order || !["returned", "refund_pending"].includes(order.status)) return "El pedido no está listo para reembolso";
  if (order.stripe_dispute_status && order.stripe_dispute_status !== "won") return "Existe un contracargo que requiere conciliación antes de reembolsar";
  return null;
}
