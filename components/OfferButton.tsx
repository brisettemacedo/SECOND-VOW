"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function OfferButton({dressId,price,userId,sellerId,status}:{dressId:string;price:number;userId?:string;sellerId:string;status:string}){
 const supabase=useMemo(()=>createClient(),[]);const router=useRouter();const[busy,setBusy]=useState(false);
 async function go(){if(!userId){router.push(`/login?next=/vestidos/${dressId}`);return}if(userId===sellerId)return;setBusy(true);const {data,error}=await supabase.rpc("get_or_create_conversation",{p_dress_id:dressId});setBusy(false);if(error)alert(error.message);else router.push(`/mensajes?conversation=${data}`)}
 if(userId===sellerId)return null;
 if(status!=="approved")return <button className="btn btn-secondary" disabled>{status==="reserved"?"Pago en proceso":status==="sold"?"Vendido":"No disponible"}</button>;
 return <button className="btn btn-secondary" disabled={busy} onClick={go}>{busy?"Abriendo conversación...":"Hacer oferta"}</button>
}
