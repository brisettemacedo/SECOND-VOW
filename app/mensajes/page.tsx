import MessagesClient from "@/components/MessagesClient";
import { requireUser } from "@/lib/auth";
import { safeDisplayName } from "@/lib/displayName";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function MessagesPage({searchParams}:{searchParams?:Promise<{conversation?:string;page?:string}>}){
  const query=await(searchParams??Promise.resolve<{conversation?:string;page?:string}>({}));
  const page=Math.max(1,Number(query.page)||1);
  const from=(page-1)*PAGE_SIZE;
  const to=from+PAGE_SIZE-1;
  const {supabase,user}=await requireUser();
  await supabase.rpc("expire_stale_offers");
  await supabase.rpc("refresh_my_offer_reminders");
  const {data,error,count}=await supabase.from("conversations")
    .select("id,dress_id,buyer_id,seller_id,buyer_postal_code,shipping_destination_type,recipient_full_name,recipient_phone,shipping_street1,shipping_street2,shipping_neighborhood,shipping_city,shipping_state,shipping_branch_name,shipping_destination_set_at,last_message_at,dresses(id,model,precio_venta_mxn,brands(name))",{count:"exact"})
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("last_message_at",{ascending:false})
    .range(from,to);
  if(error) return <main className="page"><h1>Mensajes</h1><div className="alert-error">{error.message}</div></main>;
  const conversations=data??[];
  const activeConversation=(conversations as any[]).find((c:any)=>c.id===query.conversation)??conversations[0];
  const participantIds=Array.from(new Set(conversations.flatMap((c:any)=>[c.buyer_id,c.seller_id]).filter(Boolean)));
  const [{data:latestMessages},{data:offers},{data:orders},{data:profiles}]=await Promise.all([
    activeConversation ? supabase.from("messages").select("id,sender_id,body,created_at,read_at").eq("conversation_id",activeConversation.id).order("created_at",{ascending:false}).limit(100) : Promise.resolve({data:[]} as any),
    activeConversation ? supabase.from("offers").select("id,conversation_id,dress_id,buyer_id,seller_id,created_by,parent_offer_id,amount_mxn,shipping_mxn,status,expires_at,created_at,responded_at,accepted_at,note").eq("conversation_id",activeConversation.id).order("created_at") : Promise.resolve({data:[]} as any),
    activeConversation ? supabase.from("orders").select("id,public_code,dress_id,buyer_id,seller_id,status,subtotal_mxn,shipping_mxn,total_mxn,shipping_quote_set_at,shipping_carrier_declared,carrier,tracking_number,payment_deadline_at,created_at,paid_at,shipped_at,delivered_at").eq("dress_id",activeConversation.dress_id).eq("buyer_id",activeConversation.buyer_id).eq("seller_id",activeConversation.seller_id).order("created_at") : Promise.resolve({data:[]} as any),
    participantIds.length ? supabase.from("profiles").select("id,full_name").in("id",participantIds) : Promise.resolve({data:[]} as any),
  ]);
  const profileMap=Object.fromEntries((profiles??[]).map((x:any)=>[x.id,safeDisplayName(x.full_name)]));
  const initial=(conversations as any[]).map((c:any)=>({
    ...c,
    buyer_name:profileMap[c.buyer_id]||"Compradora",
    seller_name:profileMap[c.seller_id]||"Vendedora",
    messages:c.id===activeConversation?.id?[...(latestMessages??[])].reverse():[],
    offers:c.id===activeConversation?.id?(offers??[]):[],
    orders:c.id===activeConversation?.id?(orders??[]):[],
  }));
  const total=count??conversations.length;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <main className="page"><h1>Mensajes</h1><p className="muted">Cada conversación conserva el vestido, las ofertas y el seguimiento en un solo lugar.</p><MessagesClient initial={initial as any} userId={user.id} initialActive={activeConversation?.id}/>{totalPages>1&&<nav className="message-pagination" aria-label="Páginas de conversaciones"><Link className={`btn btn-secondary${page<=1?" disabled":""}`} aria-disabled={page<=1} href={page<=1?"#":`/mensajes?page=${page-1}`}>Anterior</Link><span>Página {page} de {totalPages}</span><Link className={`btn btn-secondary${page>=totalPages?" disabled":""}`} aria-disabled={page>=totalPages} href={page>=totalPages?"#":`/mensajes?page=${page+1}`}>Siguiente</Link></nav>}</main>
}
