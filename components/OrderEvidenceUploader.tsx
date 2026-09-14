"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { validateUploadMedia } from "@/lib/mediaValidation";

const LABELS: Record<string,string> = {seller_pre_ship:"Vestido antes de empacar",seller_packed:"Paquete cerrado",seller_shipping_receipt:"Comprobante de envío",buyer_package_received:"Paquete al recibirlo",buyer_unboxing:"Apertura del paquete",buyer_dress_received:"Evidencia de la reclamación",seller_claim_response:"Evidencia de la respuesta",seller_return_label:"Guía prepagada (PDF o imagen)",buyer_return_packed:"Vestido y paquete de devolución",seller_return_received:"Devolución recibida",other:"Otra evidencia"};

export default function OrderEvidenceUploader({orderId,userId,stage,existing=[],showFiles=false,readOnly=false}:{orderId:string;userId:string;stage:string;existing?:any[];showFiles?:boolean;readOnly?:boolean}) {
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter();
  const [items,setItems]=useState(existing); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
  async function upload(files:FileList|null) {
    if(!files?.length)return; setBusy(true); setMsg("");
    try {
      for(const file of Array.from(files)) {
        await validateUploadMedia(file,{allowPdf:true,maxVideoSeconds:180});
        const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";
        const path=`${userId}/${orderId}/${crypto.randomUUID()}.${ext}`;
        const {error:uploadError}=await supabase.storage.from("order-evidence").upload(path,file,{upsert:false});
        if(uploadError)throw uploadError;
        const {data,error}=await supabase.from("order_evidence").insert({order_id:orderId,uploaded_by:userId,evidence_type:stage,storage_path:path}).select().single();
        if(error)throw error; setItems(current=>[...current,data]);
      }
      setMsg("Evidencia guardada."); router.refresh();
    } catch(error:any) { setMsg(error?.message||"No fue posible guardar la evidencia."); }
    finally { setBusy(false); }
  }
  return <div className="evidence-uploader"><label><strong>{LABELS[stage]||"Evidencia"}</strong>{!readOnly&&<><span>Fotos, PDF o video MP4 de hasta 3 minutos.</span><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" multiple disabled={busy} onChange={event=>upload(event.target.files)}/></>}</label>{items.length>0&&<small>{items.length} archivo(s) guardado(s)</small>}{showFiles&&items.some((item:any)=>item.signed_url)&&<div className="evidence-links">{items.filter((item:any)=>item.signed_url).map((item:any,index:number)=><a href={item.signed_url} target="_blank" rel="noreferrer" key={item.id}>Abrir archivo {index+1}</a>)}</div>}{msg&&<small>{msg}</small>}</div>;
}
