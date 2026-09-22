"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OrderNextActionCard from "@/components/OrderNextActionCard";
import { ORDER_STATUS } from "@/lib/orderDisplay";
import { hasDisallowedContactContent, OFF_PLATFORM_MESSAGE } from "@/lib/contentModeration";

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
 const [offers,setOffers]=useState<any[]>(activeConv?.offers??[]);
 const [orders,setOrders]=useState<any[]>(activeConv?.orders??[]);
 const [body,setBody]=useState("");
 const [proposalAmount,setProposalAmount]=useState("");
 const [proposalOpen,setProposalOpen]=useState(false);
 const [purchaseHelpOpen,setPurchaseHelpOpen]=useState(false);
 const [offerOpen,setOfferOpen]=useState(false);
 const [offerAmount,setOfferAmount]=useState("");
 const [offerShipping,setOfferShipping]=useState("");
 const [offerNote,setOfferNote]=useState("");
 const [postalCode,setPostalCode]=useState(activeConv?.buyer_postal_code??"");
 const [destination,setDestination]=useState({type:activeConv?.shipping_destination_type??"home",name:activeConv?.recipient_full_name??"",phone:activeConv?.recipient_phone??"",street1:activeConv?.shipping_street1??"",street2:activeConv?.shipping_street2??"",neighborhood:activeConv?.shipping_neighborhood??"",city:activeConv?.shipping_city??"",state:activeConv?.shipping_state??"",branch:activeConv?.shipping_branch_name??""});
 const [busy,setBusy]=useState(false); const [detailsLoading,setDetailsLoading]=useState(false); const [error,setError]=useState("");
 const dispatchEmails=()=>fetch("/api/notifications/dispatch",{method:"POST"}).catch(()=>undefined);
 async function refreshConversation(){router.refresh()}
 async function load(id:string){
   const next=convs.find(c=>c.id===id);if(!next)return;
   setActive(id);setDetailsLoading(true);setError("");setBody("");setProposalAmount("");setProposalOpen(false);setPurchaseHelpOpen(false);setOfferOpen(false);
   setPostalCode(next.buyer_postal_code??"");setDestination({type:next.shipping_destination_type??"home",name:next.recipient_full_name??"",phone:next.recipient_phone??"",street1:next.shipping_street1??"",street2:next.shipping_street2??"",neighborhood:next.shipping_neighborhood??"",city:next.shipping_city??"",state:next.shipping_state??"",branch:next.shipping_branch_name??""});
   const [messageResult,offerResult,orderResult]=await Promise.all([
     supabase.from("messages").select("id,sender_id,body,created_at,read_at").eq("conversation_id",id).order("created_at",{ascending:false}).limit(100),
     supabase.from("offers").select("*").eq("conversation_id",id).order("created_at"),
     supabase.from("orders").select("*").eq("dress_id",next.dress_id).eq("buyer_id",next.buyer_id).eq("seller_id",next.seller_id).order("created_at")
   ]);
   const loadError=messageResult.error||offerResult.error||orderResult.error;
   if(loadError)setError("No pudimos cargar toda la conversación. Intenta nuevamente.");
   setMessages([...(messageResult.data??[])].reverse());setOffers(offerResult.data??[]);setOrders(orderResult.data??[]);setDetailsLoading(false);
   await supabase.rpc("mark_conversation_read",{p_conversation_id:id});
 }
 async function send(){
   const text=body.trim();if(!text||!active)return;
   if(hasDisallowedContactContent(text)){setError(OFF_PLATFORM_MESSAGE);return}
   const {data,error}=await supabase.from("messages").insert({conversation_id:active,sender_id:userId,body:text}).select().single();
   if(error){setError(error.message);return}if(data){setMessages(m=>[...m,data]);setBody("");setError("")}
 }
 async function createOffer(){
   if(!activeConv)return;
   const amount=Number(offerAmount);
   const shipping=Number(offerShipping||0);
   if(!amount||amount<=0)return;
   if(offerShipping!==""&&shipping<0)return;
   if(offerNote.trim()&&hasDisallowedContactContent(offerNote)){setError(OFF_PLATFORM_MESSAGE);return}
   setBusy(true);setError("");
   const {error}=await supabase.rpc("create_offer",{p_dress_id:activeConv.dress_id,p_amount_mxn:amount,p_shipping_mxn:shipping,p_conversation_id:activeConv.id,p_note:offerNote.trim()||null});
   setBusy(false);
   if(error)setError(error.message);
   else{void dispatchEmails();setOfferOpen(false);setOfferAmount("");setOfferShipping("");setOfferNote("");await load(activeConv.id);refreshConversation()}
 }
 async function saveDestination(){
   if(!activeConv||!/^[0-9]{5}$/.test(postalCode)||destination.name.trim().length<5||destination.phone.replace(/\D/g,"").length<10||!destination.street1.trim()||!destination.city.trim()||!destination.state.trim()||(destination.type==="carrier_branch"&&!destination.branch.trim())){setError("Completa el nombre de quien recibirá, teléfono y destino de envío.");return}
   setBusy(true);setError("");
   const {error}=await supabase.rpc("set_conversation_shipping_destination",{p_conversation_id:activeConv.id,p_destination_type:destination.type,p_recipient_full_name:destination.name.trim(),p_recipient_phone:destination.phone.trim(),p_street1:destination.street1.trim(),p_street2:destination.street2.trim()||null,p_neighborhood:destination.neighborhood.trim()||null,p_city:destination.city.trim(),p_state:destination.state.trim(),p_postal_code:postalCode,p_branch_name:destination.type==="carrier_branch"?destination.branch.trim():null});
   setBusy(false);if(error)setError(error.message);else{await load(activeConv.id);refreshConversation()}
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
   setBusy(false);if(error)setError(error.message);else{void dispatchEmails();await load(active);refreshConversation()}
 }
 async function cancelOffer(id:string){
   setBusy(true);setError("");
   const {error}=await supabase.rpc("cancel_offer",{p_offer_id:id});
   setBusy(false);if(error)setError(error.message);else{void dispatchEmails();await load(active);refreshConversation()}
 }
 function askToResend(){
   setBody("Hola, tu oferta anterior ya venció y no alcancé a pagar. ¿Me la puedes volver a enviar para proceder al pago?");
 }
 function proposePrice(){
   const amount=Number(proposalAmount);if(!amount||amount<=0)return;
   setBody(`Hola, ¿aceptarías ${money(amount)} por el vestido? Cuando tengas el envío cotizado, ¿me mandas la oferta final?`);
   setProposalOpen(false);
 }
 function showCurrentOffer(){
   const activity=document.getElementById("current-offer") as HTMLDetailsElement|null;
   if(!activity)return;
   activity.open=true;
   activity.scrollIntoView({behavior:"smooth",block:"center"});
 }
 useEffect(()=>{if(!active)return;const ch=supabase.channel(`messages:${active}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${active}`},(p:any)=>{const row=p.new as any;setMessages(m=>m.some(x=>x.id===row.id)?m:[...m,row])}).subscribe();return()=>{supabase.removeChannel(ch)}},[active,supabase]);
 const timeline=useMemo(()=>{if(!activeConv)return[];const items:any[]=[];(messages??[]).forEach(m=>items.push({kind:"message",at:m.created_at,data:m}));offers.forEach(o=>items.push({kind:"offer",at:o.created_at,data:o}));orders.forEach(o=>{items.push({kind:"order",at:o.created_at,data:o});if(o.shipping_quote_set_at)items.push({kind:"shipping",at:o.shipping_quote_set_at,data:o});if(o.shipped_at)items.push({kind:"shipment",at:o.shipped_at,data:o})});return items.sort((a,b)=>String(a.at).localeCompare(String(b.at)))},[activeConv,messages,offers,orders]);
 const conversationMessages=timeline.filter(item=>item.kind==="message");
 const operationActivity=timeline.filter(item=>item.kind!=="message").reverse();

 // Solo la vendedora puede enviar una oferta formal (regla de negocio: la
 // compradora puede preguntar precio por chat libremente, pero solo la
 // vendedora emite el compromiso de precio + envío + plazo).
 const activeOrders=orders.filter((o:any)=>!["cancelled","completed","refunded"].includes(o.status));
 const hasActiveOrder=activeOrders.length>0;
 const canOffer=activeConv?.seller_id===userId && activeConv?.dresses?.precio_venta_mxn && activeConv?.shipping_destination_set_at && !hasActiveOrder;

 // ¿Ya hay una oferta suya pendiente y vigente? No dejamos enviar una segunda
 // (create_offer también lo bloquea en el backend; esto solo evita el viaje
 // de red innecesario y el mensaje de error confuso).
 const hasActivePendingOffer=offers.some((o:any)=>o.status==="pending"&&new Date(o.expires_at).getTime()>Date.now());
 const activePendingOffer=[...offers].reverse().find((o:any)=>o.status==="pending"&&new Date(o.expires_at).getTime()>Date.now());

 // ¿La compradora tiene una oferta ya vencida sin haber pagado? Le ofrecemos
 // el atajo de pedir el reenvío (regla 2), en vez de dejarla adivinar qué hacer.
 const latestOffer=[...offers].at(-1);
 const hasExpiredOfferForBuyer=activeConv?.buyer_id===userId&&!hasActiveOrder&&!hasActivePendingOffer&&latestOffer&&((latestOffer.status==="expired")||(latestOffer.status==="pending"&&new Date(latestOffer.expires_at).getTime()<=Date.now()));

 const currentOrder=[...orders].reverse().find((o:any)=>!["cancelled","completed","refunded"].includes(o.status))||orders.at(-1);
 const isBuyer=activeConv?.buyer_id===userId;
 const quickReplies=isBuyer?["¿Sigue disponible?","¿Puedes confirmar las medidas?","Quiero recibir una oferta final"]:["Sí, sigue disponible","Estoy cotizando tu envío","Te envío la oferta en breve"];
 return <div className="messaging">
  <aside>{convs.map(c=>{const other=c.buyer_id===userId?c.seller_name:c.buyer_name;return <button key={c.id} className={active===c.id?"active":""} onClick={()=>load(c.id)}><strong>{dressTitle(c.dresses)}</strong><span className="conversation-meta">Con {other||"Usuaria"}</span><span>{new Date(c.last_message_at).toLocaleDateString("es-MX")}</span></button>})}</aside>
  <section className="chat panel">{activeConv?<>
    <div className="chat-dress-header">
      <div><span className="muted">Conversación con {isBuyer?(activeConv.seller_name||"la vendedora"):(activeConv.buyer_name||"la compradora")}</span><h2><Link href={`/vestidos/${activeConv.dress_id}`} target="_blank" rel="noopener noreferrer">{dressTitle(activeConv.dresses)}</Link></h2>{activeConv.dresses?.precio_venta_mxn&&<span>{money(activeConv.dresses.precio_venta_mxn)}</span>}</div>
      <div className="chat-header-actions">
        {isBuyer&&!hasActiveOrder&&<button type="button" className="btn btn-secondary" onClick={()=>setProposalOpen(true)}>Proponer precio</button>}
        {isBuyer&&!hasActiveOrder&&<button type="button" className="btn btn-primary" onClick={()=>activePendingOffer?showCurrentOffer():setPurchaseHelpOpen(true)}>{activePendingOffer?"Ver oferta":"Comprar"}</button>}
        {canOffer&&!hasActivePendingOffer&&<button type="button" className="btn btn-primary" onClick={()=>setOfferOpen(true)}>Enviar oferta final</button>}
        <Link className="btn btn-secondary" href={`/vestidos/${activeConv.dress_id}`} target="_blank" rel="noopener noreferrer">Ver vestido</Link>
      </div>
    </div>
    {currentOrder&&<OrderNextActionCard order={currentOrder} userId={userId} compact />}
    <details className="chat-help"><summary>Compra y conversa con seguridad</summary><p>Mantén la conversación, la oferta y el pago dentro de SECOND VOW. El historial protege a ambas si existe una reclamación.</p></details>
    {activeConv?.buyer_id===userId&&!activeConv.shipping_destination_set_at&&<details id="shipping-destination" className="chat-context" open><summary>1. Comparte tu destino para cotizar el envío</summary><div className="chat-context-body"><p className="muted">Solo la vendedora y SECOND VOW podrán verlo.</p><div className="grid-2"><label><span>Entrega en</span><select value={destination.type} onChange={e=>setDestination(v=>({...v,type:e.target.value as "home"|"carrier_branch"}))}><option value="home">Mi domicilio</option><option value="carrier_branch">Ocurre / sucursal</option></select></label><label><span>Nombre completo de quien recibirá</span><input value={destination.name} onChange={e=>setDestination(v=>({...v,name:e.target.value}))}/></label><label><span>Teléfono</span><input value={destination.phone} onChange={e=>setDestination(v=>({...v,phone:e.target.value}))}/></label><label><span>Calle y número o dirección de sucursal</span><input value={destination.street1} onChange={e=>setDestination(v=>({...v,street1:e.target.value}))}/></label><label><span>Interior o referencia</span><input value={destination.street2} onChange={e=>setDestination(v=>({...v,street2:e.target.value}))}/></label><label><span>Colonia</span><input value={destination.neighborhood} onChange={e=>setDestination(v=>({...v,neighborhood:e.target.value}))}/></label><label><span>Ciudad</span><input value={destination.city} onChange={e=>setDestination(v=>({...v,city:e.target.value}))}/></label><label><span>Estado</span><input value={destination.state} onChange={e=>setDestination(v=>({...v,state:e.target.value}))}/></label><label><span>Código postal</span><input inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5))}/></label>{destination.type==="carrier_branch"&&<label><span>Paquetería y nombre de sucursal</span><input value={destination.branch} onChange={e=>setDestination(v=>({...v,branch:e.target.value}))}/></label>}</div><button className="btn btn-primary" disabled={busy} onClick={saveDestination}>Guardar destino</button></div></details>}
    {activeConv?.shipping_destination_set_at&&<details className="chat-context"><summary>Destino listo · C.P. {activeConv.buyer_postal_code}</summary><div className="chat-context-body"><p>{activeConv.shipping_destination_type==="carrier_branch"?`${activeConv.shipping_branch_name}: `:""}{activeConv.shipping_street1}, {activeConv.shipping_city}, {activeConv.shipping_state}. Recibe: {activeConv.recipient_full_name}.</p></div></details>}
    {activeConv?.seller_id===userId&&!activeConv.shipping_destination_set_at&&<p className="chat-status-note">La compradora aún debe compartir su destino antes de que puedas enviar la oferta final.</p>}
    {detailsLoading?<div className="chat-loading">Cargando conversación…</div>:<>
      {operationActivity.length>0&&<details id="current-offer" className="operation-activity">
        <summary><span>Actividad de la operación</span><small>{operationActivity.length} {operationActivity.length===1?"movimiento":"movimientos"}</small></summary>
        <div className="operation-activity-list">{operationActivity.map((item:any)=>{if(item.kind==="offer"){
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
            <button type="button" data-offer-action="accept" className="btn btn-primary" disabled={busy} onClick={()=>acceptOffer(o.id)}>Aceptar y continuar al pago</button>
            <button type="button" data-offer-action="decline" className="btn btn-secondary" disabled={busy} onClick={()=>declineOffer(o.id)}>Rechazar</button>
          </div>}
          {canCancel&&<div className="commerce-actions"><button type="button" data-offer-action="cancel" className="btn btn-secondary" disabled={busy} onClick={()=>cancelOffer(o.id)}>Cancelar oferta pendiente</button></div>}
        </div>
      }
      if(item.kind==="order"){const o=item.data;return <div key={`ord-${o.id}`} className="commerce-event order-event"><div className="commerce-event-label">Pedido creado</div><strong>{money(o.subtotal_mxn)} vestido + {money(o.shipping_mxn)} envío = {money(o.total_mxn)}</strong><span className="badge">{ORDER_STATUS[o.status]||STATUS[o.status]||o.status}</span><Link href={`/pedidos/${o.id}`}>Abrir pedido</Link></div>}
      if(item.kind==="shipment"){const o=item.data;return <div key={`ship-${o.id}`} className="commerce-event order-event"><div className="commerce-event-label">Vestido enviado</div><strong>{o.carrier||o.shipping_carrier_declared||"Paquetería"}: {o.tracking_number||"guía registrada"}</strong><small>Envío asegurado, con firma y entrega contra identificación.</small><Link href={`/pedidos/${o.id}`}>Ver rastreo y evidencias</Link></div>}
      const o=item.data;return <div key={`ship-${o.id}`} className="commerce-event shipping-event"><div className="commerce-event-label">Envío cotizado</div><strong>{money(o.shipping_mxn)}</strong>{o.shipping_carrier_declared&&<span>{o.shipping_carrier_declared}</span>}<p>Total de la operación: {money(o.total_mxn)}</p><Link href={`/pedidos/${o.id}`}>Continuar en el pedido</Link></div>})}</div>
      </details>}
      <div className="messages">{conversationMessages.length?conversationMessages.map((item:any)=>{const m=item.data;return <div key={`m-${m.id}`} className={m.sender_id===userId?"bubble mine":"bubble"}>{m.body}<small>{new Date(m.created_at).toLocaleString("es-MX")}</small></div>}):<p className="chat-empty">Aún no hay mensajes. Escribe para iniciar la conversación.</p>}</div>
    </>}
    {error&&<div className="alert-error moderation-copy" role="alert">{error}</div>}

    {canOffer&&hasActivePendingOffer&&<p className="chat-status-note">La oferta está pendiente. Podrás enviar otra cuando la compradora responda o venza.</p>}

    {hasExpiredOfferForBuyer && !canOffer && <div className="chat-offer-box">
      <p className="muted">La oferta anterior ya venció. Si sigues interesada, pídele a la vendedora que te la vuelva a enviar.</p>
      <button className="btn btn-secondary" onClick={askToResend}>Pedir que reenvíe la oferta</button>
    </div>}

    <div className="quick-replies" aria-label="Mensajes sugeridos">{quickReplies.map(reply=><button type="button" key={reply} onClick={()=>setBody(reply)}>{reply}</button>)}</div>
    <div className="composer"><textarea value={body} onChange={e=>{setBody(e.target.value);if(error===OFF_PLATFORM_MESSAGE)setError("")}} maxLength={2000} placeholder="Escribe un mensaje"/><button className="btn btn-primary" onClick={send}>Enviar</button></div>

    {proposalOpen&&<div className="sv-modal-backdrop" role="presentation" onMouseDown={()=>setProposalOpen(false)}><div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="proposal-title" onMouseDown={event=>event.stopPropagation()}><button className="sv-modal-close" type="button" aria-label="Cerrar" onClick={()=>setProposalOpen(false)}>×</button><h2 id="proposal-title">Proponer precio</h2><p>Precio publicado: <strong>{money(activeConv.dresses?.precio_venta_mxn)}</strong></p><label><span>Tu propuesta</span><div className="modal-money-input"><span>$</span><input autoFocus type="number" min="1" max={activeConv.dresses?.precio_venta_mxn} value={proposalAmount} onChange={e=>setProposalAmount(e.target.value)} placeholder="0"/></div></label><div className="modal-suggestions">{[.85,.9,.95].map(rate=>{const suggestion=Math.round(Number(activeConv.dresses?.precio_venta_mxn||0)*rate);return <button type="button" key={rate} onClick={()=>setProposalAmount(String(suggestion))}>{money(suggestion)}</button>})}</div><p className="muted">Se preparará un mensaje para la vendedora. Ella enviará la oferta final con el envío cotizado.</p><button type="button" className="btn btn-primary" disabled={!proposalAmount} onClick={proposePrice}>Agregar al mensaje</button></div></div>}

    {purchaseHelpOpen&&<div className="sv-modal-backdrop" role="presentation" onMouseDown={()=>setPurchaseHelpOpen(false)}><div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onMouseDown={event=>event.stopPropagation()}><button className="sv-modal-close" type="button" aria-label="Cerrar" onClick={()=>setPurchaseHelpOpen(false)}>×</button><h2 id="purchase-title">Comprar este vestido</h2><p>{activeConv.shipping_destination_set_at?"Pide a la vendedora que te envíe la oferta final con el costo de envío.":"Primero comparte tu destino para que la vendedora pueda cotizar el envío."}</p><button type="button" className="btn btn-primary" onClick={()=>{setPurchaseHelpOpen(false);if(activeConv.shipping_destination_set_at){setBody("Hola, quiero comprar el vestido. ¿Me envías la oferta final con el envío cotizado?")}else{document.getElementById("shipping-destination")?.scrollIntoView({behavior:"smooth",block:"start"})}}}>{activeConv.shipping_destination_set_at?"Pedir oferta final":"Compartir destino"}</button></div></div>}

    {offerOpen&&<div className="sv-modal-backdrop" role="presentation" onMouseDown={()=>setOfferOpen(false)}><div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="offer-title" onMouseDown={event=>event.stopPropagation()}><button className="sv-modal-close" type="button" aria-label="Cerrar" onClick={()=>setOfferOpen(false)}>×</button><h2 id="offer-title">Enviar oferta final</h2><p>Precio publicado: <strong>{money(activeConv.dresses?.precio_venta_mxn)}</strong></p><label><span>Precio acordado del vestido</span><div className="modal-money-input"><span>$</span><input autoFocus type="number" min="1" max={activeConv.dresses?.precio_venta_mxn} value={offerAmount} onChange={e=>setOfferAmount(e.target.value)} placeholder="0"/></div></label><div className="modal-suggestions">{[.85,.9,1].map(rate=>{const suggestion=Math.round(Number(activeConv.dresses?.precio_venta_mxn||0)*rate);return <button type="button" key={rate} onClick={()=>setOfferAmount(String(suggestion))}>{money(suggestion)}</button>})}</div><label><span>Envío cotizado</span><div className="modal-money-input"><span>$</span><input type="number" min="0" value={offerShipping} onChange={e=>setOfferShipping(e.target.value)} placeholder="0"/></div></label>{offerAmount&&<p className="offer-total">Total para la compradora: <strong>{money(Number(offerAmount||0)+Number(offerShipping||0))}</strong></p>}<label><span>Mensaje opcional</span><input value={offerNote} maxLength={500} onChange={e=>setOfferNote(e.target.value)} placeholder="Ej. Incluye envío asegurado"/></label><button type="button" className="btn btn-primary" disabled={busy||!offerAmount} onClick={createOffer}>Enviar oferta final</button></div></div>}
  </>:<p>Selecciona una conversación.</p>}</section>
 </div>
}
