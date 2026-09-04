"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OrderNextActionCard from "@/components/OrderNextActionCard";
import { ORDER_STATUS } from "@/lib/orderDisplay";

type Conv={id:string;dress_id:string;buyer_id:string;seller_id:string;buyer_postal_code?:string|null;shipping_destination_type?:"home"|"carrier_branch"|null;recipient_full_name?:string|null;recipient_phone?:string|null;shipping_street1?:string|null;shipping_street2?:string|null;shipping_neighborhood?:string|null;shipping_city?:string|null;shipping_state?:string|null;shipping_branch_name?:string|null;shipping_destination_set_at?:string|null;buyer_name?:string;seller_name?:string;last_message_at:string;dresses?:any;messages?:any[];offers?:any[];orders?:any[]};
function cleanModel(v:any){const s=String(v??"").trim();return /^(na|n\/?a|no aplica|sin modelo)$/i.test(s)?"":s}
function dressTitle(d:any){return [d?.brands?.name,cleanModel(d?.model)].filter(Boolean).join(" ")||"Vestido"}
function money(v:any){return `$${Number(v??0).toLocaleString("es-MX")} MXN`}
const STATUS:Record<string,string>={pending:"Pendiente",accepted:"Aceptada",declined:"Rechazada",rejected:"Rechazada",countered:"Reemplazada",expired:"Vencida",awaiting_payment:"Pendiente de pago",payment_processing:"Procesando pago",paid:"Pago confirmado",preparing_shipment:"Preparando envío",shipped:"Enviado",inspection:"Periodo de protección",completed:"Completado",cancelled:"Cancelado"};

export default function MessagesClient({initial,userId,initialActive}:{initial:Conv[];userId:string;initialActive?:string}){
 const supabase=useMemo(()=>createClient(),[]); const router=useRouter();
 const convs=initial;
 const first=initial.find(c=>c.id===initialActive)?.id??initial[0]?.id??"";
 const [active,setActive]=useState(first);
 const activeConv=convs.find(c=>c.id===active);
 const [messages,setMessages]=useState<any[]>(activeConv?.messages??[]);
 const [body,setBody]=useState("");
 const [offerOpen,setOfferOpen]=useState(false);
 const [offerAmount,setOfferAmount]=useState("");
 const [offerShipping,setOfferShipping]=useState("");
 const [offerNote,setOfferNote]=useState("");
 const [postalCode,setPostalCode]=useState(activeConv?.buyer_postal_code??"");
 const [destination,setDestination]=useState({type:activeConv?.shipping_destination_type??"home",name:activeConv?.recipient_full_name??"",phone:activeConv?.recipient_phone??"",street1:activeConv?.shipping_street1??"",street2:activeConv?.shipping_street2??"",neighborhood:activeConv?.shipping_neighborhood??"",city:activeConv?.shipping_city??"",state:activeConv?.shipping_state??"",branch:activeConv?.shipping_branch_name??""});
 const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 const dispatchEmails=()=>fetch("/api/notifications/dispatch",{method:"POST"}).catch(()=>undefined);
 async function refreshConversation(){router.refresh()}
 async function load(id:string){const next=convs.find(c=>c.id===id);setActive(id);setPostalCode(next?.buyer_postal_code??"");setDestination({type:next?.shipping_destination_type??"home",name:next?.recipient_full_name??"",phone:next?.recipient_phone??"",street1:next?.shipping_street1??"",street2:next?.shipping_street2??"",neighborhood:next?.shipping_neighborhood??"",city:next?.shipping_city??"",state:next?.shipping_state??"",branch:next?.shipping_branch_name??""});setError("");const {data}=await supabase.from("messages").select("id,sender_id,body,created_at,read_at").eq("conversation_id",id).order("created_at");setMessages(data??[]);await supabase.rpc("mark_conversation_read",{p_conversation_id:id})}
 async function send(){const text=body.trim();if(!text||!active)return; const {data,error}=await supabase.from("messages").insert({conversation_id:active,sender_id:userId,body:text}).select().single();if(error){setError(error.message);return}if(data){setMessages(m=>[...m,data]);setBody("")}}
 async function createOffer(){
   if(!activeConv)return;
   const amount=Number(offerAmount);
   const shipping=Number(offerShipping||0);
   if(!amount||amount<=0)return;
   if(offerShipping!==""&&shipping<0)return;
   setBusy(true);setError("");
   const {error}=await supabase.rpc("create_offer",{p_dress_id:activeConv.dress_id,p_amount_mxn:amount,p_shipping_mxn:shipping,p_conversation_id:activeConv.id,p_note:offerNote.trim()||null});
   setBusy(false);
   if(error)setError(error.message);
   else{void dispatchEmails();setOfferOpen(false);setOfferAmount("");setOfferShipping("");setOfferNote("");refreshConversation()}
 }
 async function saveDestination(){
   if(!activeConv||!/^[0-9]{5}$/.test(postalCode)||destination.name.trim().length<5||destination.phone.replace(/\D/g,"").length<10||!destination.street1.trim()||!destination.city.trim()||!destination.state.trim()||(destination.type==="carrier_branch"&&!destination.branch.trim())){setError("Completa el nombre de quien recibirá, teléfono y destino de envío.");return}
   setBusy(true);setError("");
   const {error}=await supabase.rpc("set_conversation_shipping_destination",{p_conversation_id:activeConv.id,p_destination_type:destination.type,p_recipient_full_name:destination.name.trim(),p_recipient_phone:destination.phone.trim(),p_street1:destination.street1.trim(),p_street2:destination.street2.trim()||null,p_neighborhood:destination.neighborhood.trim()||null,p_city:destination.city.trim(),p_state:destination.state.trim(),p_postal_code:postalCode,p_branch_name:destination.type==="carrier_branch"?destination.branch.trim():null});
   setBusy(false);if(error)setError(error.message);else refreshConversation();
 }
 async function acceptOffer(id:string){
   setBusy(true);setError("");
   const {data,error}=await supabase.rpc("accept_offer",{p_offer_id:id});
   setBusy(false);
   if(error){setError(error.message);return}
   if(data){void dispatchEmails();router.push(`/pedidos/${data}`)}
 }
 async function declineOffer(id:string){
   setBusy(true);setError("");
   const {error}=await supabase.rpc("decline_offer",{p_offer_id:id});
   setBusy(false);if(error)setError(error.message);else{void dispatchEmails();refreshConversation()}
 }
 async function cancelOffer(id:string){
   setBusy(true);setError("");
   const {error}=await supabase.rpc("cancel_offer",{p_offer_id:id});
   setBusy(false);if(error)setError(error.message);else{void dispatchEmails();refreshConversation()}
 }
 function askToResend(){
   setBody("Hola, tu oferta anterior ya venció y no alcancé a pagar. ¿Me la puedes volver a enviar para proceder al pago?");
 }
 useEffect(()=>{if(!active)return;const ch=supabase.channel(`messages:${active}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${active}`},(p:any)=>{const row=p.new as any;setMessages(m=>m.some(x=>x.id===row.id)?m:[...m,row])}).subscribe();return()=>{supabase.removeChannel(ch)}},[active,supabase]);
 const timeline=useMemo(()=>{if(!activeConv)return[];const items:any[]=[];(messages??[]).forEach(m=>items.push({kind:"message",at:m.created_at,data:m}));(activeConv.offers??[]).forEach(o=>items.push({kind:"offer",at:o.created_at,data:o}));(activeConv.orders??[]).forEach(o=>{items.push({kind:"order",at:o.created_at,data:o});if(o.shipping_quote_set_at)items.push({kind:"shipping",at:o.shipping_quote_set_at,data:o});if(o.shipped_at)items.push({kind:"shipment",at:o.shipped_at,data:o})});return items.sort((a,b)=>String(a.at).localeCompare(String(b.at)))},[activeConv,messages]);

 // Solo la vendedora puede enviar una oferta formal (regla de negocio: la
 // compradora puede preguntar precio por chat libremente, pero solo la
 // vendedora emite el compromiso de precio + envío + plazo).
 const activeOrders=(activeConv?.orders??[]).filter((o:any)=>!["cancelled","completed","refunded"].includes(o.status));
 const hasActiveOrder=activeOrders.length>0;
 const canOffer=activeConv?.seller_id===userId && activeConv?.dresses?.precio_venta_mxn && activeConv?.shipping_destination_set_at && !hasActiveOrder;

 // ¿Ya hay una oferta suya pendiente y vigente? No dejamos enviar una segunda
 // (create_offer también lo bloquea en el backend; esto solo evita el viaje
 // de red innecesario y el mensaje de error confuso).
 const hasActivePendingOffer=(activeConv?.offers??[]).some((o:any)=>o.status==="pending"&&new Date(o.expires_at).getTime()>Date.now());

 // ¿La compradora tiene una oferta ya vencida sin haber pagado? Le ofrecemos
 // el atajo de pedir el reenvío (regla 2), en vez de dejarla adivinar qué hacer.
 const latestOffer=[...(activeConv?.offers??[])].at(-1);
 const hasExpiredOfferForBuyer=activeConv?.buyer_id===userId&&!hasActiveOrder&&!hasActivePendingOffer&&latestOffer&&((latestOffer.status==="expired")||(latestOffer.status==="pending"&&new Date(latestOffer.expires_at).getTime()<=Date.now()));

 const currentOrder=[...(activeConv?.orders??[])].reverse().find((o:any)=>!["cancelled","completed","refunded"].includes(o.status))||activeConv?.orders?.at(-1);
 return <div className="messaging">
  <aside>{convs.map(c=>{const other=c.buyer_id===userId?c.seller_name:c.buyer_name;return <button key={c.id} className={active===c.id?"active":""} onClick={()=>load(c.id)}><strong>{dressTitle(c.dresses)}</strong><span className="conversation-meta">Con {other||"Usuaria"}</span><span>{new Date(c.last_message_at).toLocaleDateString("es-MX")}</span></button>})}</aside>
  <section className="chat panel">{activeConv?<>
    <div className="chat-dress-header"><div><span className="muted">Conversación sobre</span><h2><Link href={`/vestidos/${activeConv.dress_id}`} target="_blank" rel="noopener noreferrer">{dressTitle(activeConv.dresses)}</Link></h2>{activeConv.dresses?.precio_venta_mxn&&<span>{money(activeConv.dresses.precio_venta_mxn)}</span>}<div className="chat-party-line"><span><strong>Vendedora:</strong> {activeConv.seller_name||"Vendedora"}</span><span><strong>Compradora:</strong> {activeConv.buyer_name||"Compradora"}</span></div></div><Link className="btn btn-secondary" href={`/vestidos/${activeConv.dress_id}`} target="_blank" rel="noopener noreferrer">Ver vestido</Link></div>
    {currentOrder&&<OrderNextActionCard order={currentOrder} userId={userId} compact />}
    <div className="safety-callout"><strong>Mantén todo dentro de SECOND VOW.</strong><span>No recomendamos reunirse en persona ni realizar pagos o acuerdos fuera de la plataforma. El historial del chat, ofertas y pedidos es importante si existe una reclamación.</span></div>
    {activeConv?.buyer_id===userId&&!activeConv.shipping_destination_set_at&&<div className="chat-offer-box"><strong>Comparte el destino privado del envío</strong><p className="muted">Solo la vendedora de este vestido y SECOND VOW podrán verlo. La vendedora lo necesita para cotizar el envío asegurado.</p><div className="grid-2"><label><span>Entrega en</span><select value={destination.type} onChange={e=>setDestination(v=>({...v,type:e.target.value as "home"|"carrier_branch"}))}><option value="home">Mi domicilio</option><option value="carrier_branch">Ocurre / sucursal</option></select></label><label><span>Nombre completo de quien recibirá</span><input value={destination.name} onChange={e=>setDestination(v=>({...v,name:e.target.value}))}/></label><label><span>Teléfono</span><input value={destination.phone} onChange={e=>setDestination(v=>({...v,phone:e.target.value}))}/></label><label><span>Calle y número o dirección de sucursal</span><input value={destination.street1} onChange={e=>setDestination(v=>({...v,street1:e.target.value}))}/></label><label><span>Interior o referencia</span><input value={destination.street2} onChange={e=>setDestination(v=>({...v,street2:e.target.value}))}/></label><label><span>Colonia</span><input value={destination.neighborhood} onChange={e=>setDestination(v=>({...v,neighborhood:e.target.value}))}/></label><label><span>Ciudad</span><input value={destination.city} onChange={e=>setDestination(v=>({...v,city:e.target.value}))}/></label><label><span>Estado</span><input value={destination.state} onChange={e=>setDestination(v=>({...v,state:e.target.value}))}/></label><label><span>Código postal</span><input inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5))}/></label>{destination.type==="carrier_branch"&&<label><span>Paquetería y nombre de sucursal</span><input value={destination.branch} onChange={e=>setDestination(v=>({...v,branch:e.target.value}))}/></label>}</div><button className="btn btn-primary" disabled={busy} onClick={saveDestination}>Compartir destino con la vendedora</button></div>}
    {activeConv?.shipping_destination_set_at&&<div className="alert-info"><strong>Destino compartido para cotización.</strong> {activeConv.shipping_destination_type==="carrier_branch"?`${activeConv.shipping_branch_name}: `:""}{activeConv.shipping_street1}, {activeConv.shipping_city}, {activeConv.shipping_state}, C.P. {activeConv.buyer_postal_code}. Recibe: {activeConv.recipient_full_name}. La entrega deberá ser contra identificación y firma.</div>}
    {activeConv?.seller_id===userId&&<div className="alert-info">Cuando una compradora comparta su domicilio postal, podrás cotizar el envío asegurado y enviarle una oferta final. {activeConv.shipping_destination_set_at?`Cotiza al C.P. ${activeConv.buyer_postal_code}.`:"Aún falta el destino."}</div>}
    <div className="messages">{timeline.map((item:any)=>{if(item.kind==="message"){const m=item.data;return <div key={`m-${m.id}`} className={m.sender_id===userId?"bubble mine":"bubble"}>{m.body}<small>{new Date(m.created_at).toLocaleString("es-MX")}</small></div>}
      if(item.kind==="offer"){
        const o=item.data;
        const total=Number(o.amount_mxn||0)+Number(o.shipping_mxn||0);
        const isLive=o.status==="pending"&&new Date(o.expires_at).getTime()>Date.now();
        const canRespond=isLive&&o.buyer_id===userId;
        const canCancel=isLive&&o.seller_id===userId;
        return <div key={`o-${o.id}`} className="commerce-event">
          <div className="commerce-event-label">Oferta de la vendedora</div>
          <strong>{money(o.amount_mxn)} vestido + {money(o.shipping_mxn)} envío = {money(total)}</strong>
          <span className="badge">{isLive?STATUS.pending:STATUS[o.status]||o.status}</span>
          {o.note&&<p>{o.note}</p>}
          <small>Vence {new Date(o.expires_at).toLocaleString("es-MX")}</small>
          {canRespond&&<div className="commerce-actions">
            <button className="btn btn-primary" disabled={busy} onClick={()=>acceptOffer(o.id)}>Aceptar y continuar al pago</button>
            <button className="btn btn-secondary" disabled={busy} onClick={()=>declineOffer(o.id)}>Rechazar</button>
          </div>}
          {canCancel&&<div className="commerce-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>cancelOffer(o.id)}>Cancelar oferta pendiente</button></div>}
        </div>
      }
      if(item.kind==="order"){const o=item.data;return <div key={`ord-${o.id}`} className="commerce-event order-event"><div className="commerce-event-label">Pedido creado</div><strong>{money(o.subtotal_mxn)} vestido + {money(o.shipping_mxn)} envío = {money(o.total_mxn)}</strong><span className="badge">{ORDER_STATUS[o.status]||STATUS[o.status]||o.status}</span><Link href={`/pedidos/${o.id}`}>Abrir pedido</Link></div>}
      if(item.kind==="shipment"){const o=item.data;return <div key={`ship-${o.id}`} className="commerce-event order-event"><div className="commerce-event-label">Vestido enviado</div><strong>{o.carrier||o.shipping_carrier_declared||"Paquetería"}: {o.tracking_number||"guía registrada"}</strong><small>Envío asegurado, con firma y entrega contra identificación.</small><Link href={`/pedidos/${o.id}`}>Ver rastreo y evidencias</Link></div>}
      const o=item.data;return <div key={`ship-${o.id}`} className="commerce-event shipping-event"><div className="commerce-event-label">Envío cotizado</div><strong>{money(o.shipping_mxn)}</strong>{o.shipping_carrier_declared&&<span>{o.shipping_carrier_declared}</span>}<p>Total de la operación: {money(o.total_mxn)}</p><Link href={`/pedidos/${o.id}`}>Continuar en el pedido</Link></div>})}</div>
    {error&&<div className="alert-error">{error}</div>}

    {activeConv?.seller_id===userId&&!activeConv.shipping_destination_set_at&&<div className="chat-offer-box"><p className="muted">La compradora aún debe compartir su domicilio o sucursal de entrega y el nombre completo de quien recibirá.</p></div>}
    {canOffer&&hasActivePendingOffer&&<div className="chat-offer-box"><p className="muted">Ya enviaste una oferta. Podrás enviar otra cuando la compradora la acepte, la rechace, la canceles o venza.</p></div>}
    {canOffer&&!hasActivePendingOffer&&<div className="chat-offer-box">
      {!offerOpen
        ? <button className="btn btn-secondary" onClick={()=>setOfferOpen(true)}>Hacer oferta</button>
        : <div className="offer-compose">
            <label><span>Precio del vestido (MXN)</span><input type="number" min="1" max={activeConv.dresses.precio_venta_mxn} value={offerAmount} onChange={e=>setOfferAmount(e.target.value)} placeholder="Ej. 18000"/></label>
            <label><span>Costo de envío (MXN)</span><input type="number" min="0" value={offerShipping} onChange={e=>setOfferShipping(e.target.value)} placeholder="Ej. 250"/></label>
            {offerAmount&&<p className="muted">Total que pagará la compradora: {money(Number(offerAmount||0)+Number(offerShipping||0))}.</p>}
            <label><span>Mensaje opcional</span><input value={offerNote} maxLength={500} onChange={e=>setOfferNote(e.target.value)} placeholder="Ej. Este precio ya incluye el envío asegurado"/></label>
            <div className="actions"><button className="btn btn-primary" disabled={busy||!offerAmount} onClick={createOffer}>Enviar oferta</button><button className="btn btn-secondary" onClick={()=>setOfferOpen(false)}>Cancelar</button></div>
          </div>}
    </div>}

    {hasExpiredOfferForBuyer && !canOffer && <div className="chat-offer-box">
      <p className="muted">La oferta anterior ya venció. Si sigues interesada, pídele a la vendedora que te la vuelva a enviar.</p>
      <button className="btn btn-secondary" onClick={askToResend}>Pedir que reenvíe la oferta</button>
    </div>}

    <div className="composer"><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} placeholder="Escribe un mensaje"/><button className="btn btn-primary" onClick={send}>Enviar</button></div>
  </>:<p>Selecciona una conversación.</p>}</section>
 </div>
}
