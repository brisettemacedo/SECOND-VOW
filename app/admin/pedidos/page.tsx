import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic="force-dynamic";
const PAGE_SIZE=50;
export default async function AdminOrders({searchParams}:{searchParams:Promise<{page?:string;status?:string;q?:string}>}) {
  const params=await searchParams; const {supabase}=await requireAdmin();
  const page=Math.max(1,Number(params.page)||1); const status=params.status||""; const q=(params.q||"").trim();
  let query=supabase.from("orders").select("id,public_code,status,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,processor_fee_mxn,buyer_id,seller_id,created_at",{count:"exact"}).order("created_at",{ascending:false}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  if(status)query=query.eq("status",status);
  if(q)query=query.or(`public_code.ilike.%${q}%,id.eq.${/^[0-9a-f-]{36}$/i.test(q)?q:"00000000-0000-0000-0000-000000000000"}`);
  const {data,error,count}=await query; if(error)return <main className="page"><div className="alert-error">{error.message}</div></main>;
  const rows=data??[]; const pages=Math.max(1,Math.ceil((count??0)/PAGE_SIZE));
  return <main className="page"><div className="title-row"><h1>Todos los pedidos</h1><Link className="btn btn-secondary" href="/admin">Volver</Link></div><form className="panel grid-2"><label className="field"><span>Código o UUID</span><input name="q" defaultValue={q}/></label><label className="field"><span>Estado</span><input name="status" defaultValue={status} placeholder="Ej. paid, shipped, completed"/></label><button className="btn btn-primary">Buscar</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Estado</th><th>Total</th><th>Comisión</th><th>Stripe</th><th>Margen</th><th>Fecha</th></tr></thead><tbody>{rows.map(order=><tr key={order.id}><td><Link href={`/pedidos/${order.id}`}>{order.public_code||order.id.slice(0,8)}</Link></td><td>{order.status}</td><td>${Number(order.total_mxn||0).toLocaleString("es-MX")}</td><td>${Number(order.commission_mxn||0).toLocaleString("es-MX")}</td><td>${Number(order.processor_fee_mxn||0).toLocaleString("es-MX")}</td><td>${Math.max(0,Number(order.commission_mxn||0)-Number(order.processor_fee_mxn||0)).toLocaleString("es-MX")}</td><td>{new Date(order.created_at).toLocaleDateString("es-MX")}</td></tr>)}</tbody></table></div><nav className="actions"><Link aria-disabled={page<=1} className="btn btn-secondary" href={`/admin/pedidos?page=${Math.max(1,page-1)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`}>Anterior</Link><span>Página {page} de {pages}</span><Link aria-disabled={page>=pages} className="btn btn-secondary" href={`/admin/pedidos?page=${Math.min(pages,page+1)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`}>Siguiente</Link></nav></main>;
}
