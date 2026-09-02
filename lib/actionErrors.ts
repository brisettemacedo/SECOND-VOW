const RULES: Array<[RegExp, string]> = [
  [/cancel|cancellation|cancelar/i, "No pudimos completar la cancelación. No se hizo ningún cargo nuevo y el vestido seguirá disponible mientras verificamos el pedido."],
  [/checkout|stripe|pago|payment/i, "No pudimos abrir el pago. No se realizó ningún cargo; puedes intentarlo nuevamente."],
  [/constraint|duplicate|unique|violat/i, "La operación cambió mientras la procesábamos. Actualiza la página para ver su estado más reciente."],
  [/network|fetch|conexi/i, "No pudimos conectarnos en este momento. Revisa tu conexión e inténtalo nuevamente."],
];
export function humanActionError(error: unknown, fallback = "No fue posible completar la acción.") {
  const raw = error instanceof Error ? error.message : String(error || "");
  return RULES.find(([pattern]) => pattern.test(raw))?.[1] || fallback;
}
