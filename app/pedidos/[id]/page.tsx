import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import OrderActions from "@/components/OrderActions";
import OrderNextActionCard from "@/components/OrderNextActionCard";
import { ORDER_STATUS } from "@/lib/orderDisplay";

function cleanModel(value: any) {
  const text = String(value ?? "").trim();
  return /^(na|n\/?a|no aplica|sin modelo)$/i.test(text) ? "" : text;
}
function carrierName(value: any) {
  const text = String(value ?? "").trim();
  return /^dhl$/i.test(text) ? "DHL" : /^fedex$/i.test(text) ? "FedEx" : /^ups$/i.test(text) ? "UPS" : text;
}

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ payment?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve<{ payment?: string }>({})]);
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  let orderQuery = supabase.from("orders").select("*,dresses(id,model,brands(name)),claims(*),shipments(*)").eq("id", id);
  if (profile?.role !== "admin") orderQuery = orderQuery.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
  const { data: order } = await orderQuery.maybeSingle();
  if (!order) notFound();

  const shipmentIds = (order.shipments ?? []).map((shipment: any) => shipment.id);
  const [{ data: evidence }, { data: people }, { data: trackingEvents }] = await Promise.all([
    supabase.from("order_evidence").select("id,evidence_type,storage_path,created_at,uploaded_by").eq("order_id", order.id).order("created_at"),
    supabase.from("profiles").select("id,full_name").in("id", [order.buyer_id, order.seller_id]),
    supabase.from("tracking_events").select("status_milestone,raw_status,occurred_at").in("shipment_id", shipmentIds.length ? shipmentIds : ["00000000-0000-0000-0000-000000000000"]).order("occurred_at", { ascending: false }).limit(8),
  ]);
  const names = Object.fromEntries((people ?? []).map((person: any) => [person.id, person.full_name || "Usuaria"]));
  const model = cleanModel(order.dresses?.model);
  const title = [order.dresses?.brands?.name, model].filter(Boolean).join(" ") || "Vestido";

  return <main className="page narrow">
    <div className="title-row"><div><span className="muted">Pedido {order.public_code || ""}</span><h1><Link href={`/vestidos/${order.dress_id}`} target="_blank" rel="noopener noreferrer">{title}</Link></h1><p className="order-parties"><strong>Vendedora:</strong> {names[order.seller_id] || "Vendedora"} <span>·</span> <strong>Compradora:</strong> {names[order.buyer_id] || "Compradora"}</p></div><Link className="btn btn-secondary" href={`/vestidos/${order.dress_id}`} target="_blank" rel="noopener noreferrer">Ver vestido</Link></div>
    {query.payment === "cancelled" && <div className="alert-info">Saliste de Stripe sin completar el pago. Puedes volver a intentarlo aquí mismo.</div>}
    {query.payment === "success" && !["paid", "preparing_shipment", "shipped"].includes(order.status) && <div className="alert-info">Stripe está confirmando el pago. Actualiza esta página en unos momentos; no inicies otro pago.</div>}
    <OrderNextActionCard order={order} userId={user.id} />
    <section className="panel"><p>Vestido: ${Number(order.subtotal_mxn).toLocaleString("es-MX")} MXN</p>{order.shipping_quote_set_at ? <><p>Envío fijo: ${Number(order.shipping_mxn).toLocaleString("es-MX")} MXN{order.shipping_carrier_declared ? ` con ${carrierName(order.shipping_carrier_declared)}` : ""}</p><p><strong>Total: ${Number(order.total_mxn).toLocaleString("es-MX")} MXN</strong></p></> : <p className="muted">Envío pendiente de cotización.</p>}<p>Estado: <span className="badge">{ORDER_STATUS[order.status] || order.status}</span></p>{order.tracking_number && <p>Rastreo: {carrierName(order.carrier)} | {order.tracking_number}</p>}</section>
    {(order.shipments ?? []).some((shipment: any) => shipment.tracking_error) && <div className="alert-info"><strong>Seguimiento pendiente de validación.</strong> La guía está registrada, pero el proveedor todavía no la reconoce. Esto no acredita que el envío esté confirmado ni entregado.</div>}
    {(trackingEvents ?? []).length > 0 && <section className="panel"><h2>Seguimiento del envío</h2>{(trackingEvents ?? []).map((event: any, index: number) => <div className="tracking-row" key={`${event.occurred_at}-${index}`}><strong>{ORDER_STATUS[event.status_milestone] || String(event.status_milestone || event.raw_status || "Actualización").replaceAll("_", " ")}</strong><span>{new Date(event.occurred_at).toLocaleString("es-MX")}</span></div>)}</section>}
    <OrderActions order={order} userId={user.id} evidence={evidence ?? []} />
    {(order.claims ?? []).length > 0 && <section className="panel"><h2>Reclamaciones</h2>{order.claims.map((claim: any) => <div key={claim.id}><strong>{claim.status}</strong><p>{claim.description}</p></div>)}</section>}
  </main>;
}
