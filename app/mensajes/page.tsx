import MessagesClient from "@/components/MessagesClient";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MessagesPage({searchParams}:{searchParams?:{conversation?:string}}){
  const {supabase,user}=await requireUser();
  await supabase.rpc("expire_stale_offers");
  const {data,error}=await supabase.from("conversations")
    .select("id,dress_id,buyer_id,seller_id,last_message_at,dresses(id,model,precio_venta_mxn,brands(name)),messages(id,sender_id,body,created_at,read_at)")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("last_message_at",{ascending:false});
  if(error) return <main className="page"><h1>Mensajes</h1><div className="alert-error">{error.message}</div></main>;
  const conversations=data??[];
  const ids=conversations.map((c:any)=>c.id);
  const [{data:offers},{data:orders}]=ids.length ? await Promise.all([
    supabase.from("offers").select("id,conversation_id,dress_id,buyer_id,seller_id,created_by,parent_offer_id,amount_mxn,status,expires_at,created_at,responded_at,accepted_at,note").in("conversation_id",ids).order("created_at"),
    supabase.from("orders").select("id,dress_id,buyer_id,seller_id,status,subtotal_mxn,shipping_mxn,total_mxn,shipping_quote_set_at,shipping_carrier_declared,created_at,paid_at,shipped_at,delivered_at").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("created_at")
  ]) : [{data:[]},{data:[]}];
  const initial=(conversations as any[]).map((c:any)=>({
    ...c,
    messages:[...(c.messages??[])].sort((a:any,b:any)=>a.created_at.localeCompare(b.created_at)),
    offers:(offers??[]).filter((o:any)=>o.conversation_id===c.id),
    orders:(orders??[]).filter((o:any)=>o.dress_id===c.dress_id&&o.buyer_id===c.buyer_id&&o.seller_id===c.seller_id),
  }));
  return <main className="page"><h1>Mensajes</h1><p className="muted">Mantén la conversación, las ofertas y el pago dentro de SECOND VOW para conservar el historial de la operación.</p><MessagesClient initial={initial as any} userId={user.id} initialActive={searchParams?.conversation}/></main>
}
