"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SILUETAS, ESCOTES, ESPALDAS, MANGAS, TELAS, COLORES, COLAS, CONDICIONES } from "@/lib/catalogs";

type Brand={id:string;name:string};
type Dress = Record<string, any> & { id?:string; status?:string; dress_photos?:any[] };
const stepNames=["Identidad","Talla y medidas","Diseño","Condición","Alteraciones","Precio","Ubicación y envío","Descripción","Fotografías","Revisión"];
const fieldsByStep:string[][]=[
 ["brand_id","model","collection","year_approx"],
 ["talla_etiqueta","sistema_talla","busto_cm","cintura_cm","cadera_cm","largo_hombro_piso_cm","altura_persona_cm","altura_tacon_cm","puede_ampliarse","puede_reducirse"],
 ["silueta","escote","espalda","manga","tela_principal","tela_secundaria","color_principal","color_forro","cola","cola_largo_cm"],
 ["condicion","tiene_manchas","tiene_jalones","tiene_roturas","dano_dobladillo","falta_aplicaciones","tiene_reparaciones","tiene_decoloracion","descripcion_danos"],
 ["tuvo_ajustes","ajustes_detalle","conserva_margen_costura"],
 ["precio_original_mxn","precio_venta_mxn"],
 ["ciudad","estado","envio_nacional"],
 ["descripcion"], [], []
];
const numeric=new Set(["year_approx","busto_cm","cintura_cm","cadera_cm","largo_hombro_piso_cm","altura_persona_cm","altura_tacon_cm","cola_largo_cm","precio_original_mxn","precio_venta_mxn"]);
const boolean=new Set(["puede_ampliarse","puede_reducirse","tiene_manchas","tiene_jalones","tiene_roturas","dano_dobladillo","falta_aplicaciones","tiene_reparaciones","tiene_decoloracion","tuvo_ajustes","conserva_margen_costura","envio_nacional"]);

export default function DressPublishForm({ initialDress, brands, userId }:{initialDress?:Dress;brands:Brand[];userId:string}){
 const supabase=useMemo(()=>createClient(),[]); const router=useRouter();
 const [step,setStep]=useState(0); const [dress,setDress]=useState<Dress>(initialDress??{seller_id:userId,status:"draft",sistema_talla:"MX",envio_nacional:true});
 const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const [photos,setPhotos]=useState<any[]>(initialDress?.dress_photos??[]);
 async function ensureDraft(){
   if(dress.id) return dress.id;
   const {data,error}=await supabase.from("dresses").insert({seller_id:userId,status:"draft",sistema_talla:"MX",envio_nacional:true}).select("id").single();
   if(error) throw error; setDress((d)=>({...d,id:data.id})); return data.id;
 }
 async function save(){ setBusy(true);setMessage(""); try{ const id=await ensureDraft(); const payload:any={}; for(const f of fieldsByStep.flat()) if(f in dress){ const v=dress[f]; payload[f]=numeric.has(f)?(v===""||v==null?null:Number(v)):v; } const {error}=await supabase.from("dresses").update(payload).eq("id",id); if(error) throw error; setMessage("Borrador guardado."); return id; }catch(e:any){setMessage(e.message); throw e}finally{setBusy(false)} }
 async function upload(files:FileList|null){ if(!files?.length)return; setBusy(true); try{ const id=await ensureDraft(); for(const [i,file] of Array.from(files).entries()){ const ext=file.name.split('.').pop()?.toLowerCase()||'jpg'; const path=`${userId}/${id}/${crypto.randomUUID()}.${ext}`; const {error:up}=await supabase.storage.from("dress-images").upload(path,file,{upsert:false}); if(up) throw up; const {data,error}=await supabase.from("dress_photos").insert({dress_id:id,storage_path:path,position:photos.length+i,is_primary:photos.length+i===0,classification:"frontal"}).select().single(); if(error) throw error; setPhotos(p=>[...p,data]); } setMessage("Fotografías subidas."); }catch(e:any){setMessage(e.message)}finally{setBusy(false)} }
 async function submit(){ setBusy(true); try{ const id=await save(); if(photos.length<3) throw new Error("Sube al menos 3 fotografías antes de enviar a revisión."); const {error}=await supabase.from("dresses").update({status:"pending_review"}).eq("id",id); if(error) throw error; router.push("/mis-vestidos"); router.refresh(); }catch(e:any){setMessage(e.message)}finally{setBusy(false)} }
 function set(name:string,value:any){setDress(d=>({...d,[name]:value}))}
 function options(name:string,label:string,opts:{value:string;label:string}[]){return <div className="field"><label>{label}</label><select value={dress[name]??""} onChange={e=>set(name,e.target.value||null)}><option value="">Selecciona</option>{opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>}
 function input(name:string,label:string,type="text"){return <div className="field"><label>{label}</label><input type={type} value={dress[name]??""} onChange={e=>set(name,e.target.value)} /></div>}
 function check(name:string,label:string){return <label className="check"><input type="checkbox" checked={Boolean(dress[name])} onChange={e=>set(name,e.target.checked)}/>{label}</label>}
 return <div className="wizard">
  <div className="stepper">{stepNames.map((n,i)=><button key={n} type="button" className={i===step?"active":""} onClick={()=>setStep(i)}>{i+1}. {n}</button>)}</div>
  <section className="panel"><h1>{initialDress?.id?"Editar vestido":"Publicar vestido"}</h1><h2>{stepNames[step]}</h2>
   {step===0&&<><div className="field"><label>Marca</label><select value={dress.brand_id??""} onChange={e=>set("brand_id",e.target.value||null)}><option value="">Selecciona</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>{input("model","Modelo")}{input("collection","Colección")}{input("year_approx","Año aproximado","number")}</>}
   {step===1&&<><div className="grid-2">{input("talla_etiqueta","Talla de etiqueta")}<div className="field"><label>Sistema de talla</label><select value={dress.sistema_talla??"MX"} onChange={e=>set("sistema_talla",e.target.value)}>{["MX","US","EU","UK","Otro"].map(x=><option key={x}>{x}</option>)}</select></div>{input("busto_cm","Busto (cm)","number")}{input("cintura_cm","Cintura (cm)","number")}{input("cadera_cm","Cadera (cm)","number")}{input("largo_hombro_piso_cm","Hombro a piso (cm)","number")}{input("altura_persona_cm","Altura de quien lo usó (cm)","number")}{input("altura_tacon_cm","Altura de tacón (cm)","number")}</div>{check("puede_ampliarse","Puede ampliarse")}{check("puede_reducirse","Puede reducirse")}</>}
   {step===2&&<div className="grid-2">{options("silueta","Silueta",SILUETAS)}{options("escote","Escote",ESCOTES)}{options("espalda","Espalda",ESPALDAS)}{options("manga","Manga",MANGAS)}{options("tela_principal","Tela principal",TELAS)}{options("tela_secundaria","Tela secundaria",TELAS)}{options("color_principal","Color principal",COLORES)}{input("color_forro","Color del forro")}{options("cola","Cola",COLAS)}{input("cola_largo_cm","Largo de cola (cm)","number")}</div>}
   {step===3&&<>{options("condicion","Condición",CONDICIONES)}<div className="checks">{check("tiene_manchas","Tiene manchas")}{check("tiene_jalones","Tiene jalones")}{check("tiene_roturas","Tiene roturas")}{check("dano_dobladillo","Daño en dobladillo")}{check("falta_aplicaciones","Faltan aplicaciones")}{check("tiene_reparaciones","Tiene reparaciones")}{check("tiene_decoloracion","Tiene decoloración")}</div><div className="field"><label>Describe daños o imperfecciones</label><textarea value={dress.descripcion_danos??""} onChange={e=>set("descripcion_danos",e.target.value)} rows={5}/></div></>}
   {step===4&&<>{check("tuvo_ajustes","Tuvo ajustes o alteraciones")}<div className="field"><label>Detalle de ajustes</label><textarea rows={5} value={dress.ajustes_detalle??""} onChange={e=>set("ajustes_detalle",e.target.value)}/></div>{check("conserva_margen_costura","Conserva margen de costura")}</>}
   {step===5&&<div className="grid-2">{input("precio_original_mxn","Precio original (MXN)","number")}{input("precio_venta_mxn","Precio de venta (MXN)","number")}</div>}
   {step===6&&<><div className="grid-2">{input("ciudad","Ciudad")}{input("estado","Estado")}</div>{check("envio_nacional","Disponible para envío nacional")}<p className="muted">SECOND VOW opera únicamente mediante envío; no se ofrecen pruebas ni entregas presenciales.</p></>}
   {step===7&&<div className="field"><label>Descripción</label><textarea rows={10} value={dress.descripcion??""} onChange={e=>set("descripcion",e.target.value)} placeholder="Cuenta la historia, estado y detalles del vestido."/></div>}
   {step===8&&<><div className="field"><label>Fotografías (mínimo 3)</label><input type="file" accept="image/*" multiple onChange={e=>upload(e.target.files)}/></div><div className="photo-list">{photos.map((p,i)=><div key={p.id}>Foto {i+1}{p.is_primary?" · principal":""}</div>)}</div></>}
   {step===9&&<div><p>Revisa que la publicación sea exacta. Las medidas, daños, alteraciones y autenticidad son responsabilidad de la vendedora.</p><p>Al enviar, el vestido pasará a revisión administrativa.</p></div>}
   {message&&<div className={message.includes("guardado")||message.includes("subidas")?"alert-success":"alert-error"}>{message}</div>}
   <div className="wizard-actions"><button className="btn btn-secondary" disabled={step===0||busy} onClick={()=>setStep(s=>s-1)}>Anterior</button><button className="btn btn-secondary" disabled={busy} onClick={save}>Guardar</button>{step<9?<button className="btn btn-primary" disabled={busy} onClick={async()=>{try{await save();setStep(s=>s+1)}catch{}}}>Siguiente</button>:<button className="btn btn-primary" disabled={busy} onClick={submit}>Enviar a revisión</button>}</div>
  </section>
 </div>
}
