import Link from "next/link";
import { nextActionForOrder, paymentTimeRemaining } from "@/lib/orderDisplay";

export default function OrderNextActionCard({ order, userId, compact = false }: { order: any; userId: string; compact?: boolean }) {
  const action = nextActionForOrder(order, userId);
  const remaining = ["awaiting_payment", "payment_processing"].includes(order.status) ? paymentTimeRemaining(order.payment_deadline_at) : null;
  return <div className={`next-action-card ${compact ? "compact" : ""}`}>
    <div><small>Siguiente paso</small><strong>{action.label}</strong>{remaining && <span>{remaining}</span>}</div>
    {action.cta && action.href && <Link className="btn btn-primary" href={action.href}>{action.cta}</Link>}
  </div>;
}
