export default function SellerBalanceStatus({ order, payout }: { order: any; payout?: any }) {
  if (!payout) return null;
  const activeReport = (order.claims ?? []).some((claim: any) => !["rejected", "closed", "refunded"].includes(claim.status));
  const releaseDate = order.payout_release_at;
  const parsedDate = releaseDate ? new Date(releaseDate) : null;
  const dateLabel = parsedDate && Number.isFinite(parsedDate.getTime())
    ? parsedDate.toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long", timeStyle: "short" })
    : null;
  let message = "Tu saldo estará disponible para retiro cuando termine el plazo de revisión de 48 horas después de la entrega, si no hay reportes pendientes.";
  if (["cancelled", "refunded"].includes(order.status) || payout.status === "reversed") {
    message = "Este pedido no tiene saldo disponible para retiro.";
  } else if (["paid", "paid_out", "transferred"].includes(payout.status)) {
    message = "El retiro de este saldo ya se completó.";
  } else if (["requested", "processing"].includes(payout.status)) {
    message = "Tu retiro está en proceso.";
  } else if (activeReport || payout.status === "paused") {
    message = "Tu saldo está retenido mientras se resuelve el reporte del pedido.";
  } else if (payout.status === "releasable") {
    message = "Tu saldo ya está disponible para retiro.";
  } else if (payout.status === "failed") {
    message = "El retiro no se completó. Revisa el estado en Pagos.";
  } else if (dateLabel && parsedDate!.getTime() > Date.now()) {
    message = `Tu saldo podrá retirarse a partir del ${dateLabel} (hora de Ciudad de México), si no hay reportes pendientes.`;
  } else if (dateLabel) {
    message = "El plazo de revisión terminó. La liberación automática del saldo está en proceso.";
  }
  return <section className="panel"><h2>Disponibilidad de tu saldo</h2><p>{message}</p></section>;
}
