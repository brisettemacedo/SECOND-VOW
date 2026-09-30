type ReportOrder = {
  status?: string;
  buyer_id?: string;
  platform_delivery_recorded_at?: string | null;
  dispute_deadline_at?: string | null;
  claims?: { status: string }[];
};

export function reportDeadline(order: ReportOrder): number | null {
  if (!order.platform_delivery_recorded_at) return null;
  const recorded = Date.parse(order.platform_delivery_recorded_at);
  const deadline = order.dispute_deadline_at ? Date.parse(order.dispute_deadline_at) : recorded + 48 * 60 * 60 * 1000;
  return Number.isFinite(recorded) && Number.isFinite(deadline) ? deadline : null;
}

export function canReportPackage(order: ReportOrder, userId: string, now = Date.now()): boolean {
  const deadline = reportDeadline(order);
  return order.buyer_id === userId
    && ["inspection", "delivered"].includes(order.status ?? "")
    && deadline !== null
    && now >= Date.parse(order.platform_delivery_recorded_at!)
    && now <= deadline
    && !(order.claims ?? []).some((claim) => !["rejected", "closed", "refunded"].includes(claim.status));
}
