import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { resolveDressBrandNames } from "@/lib/server/dressBrands";
import DeleteDraftButton from "@/components/DeleteDraftButton";
import { dressImageUrl } from "@/lib/storage";
import { missingDressRequirements } from "@/lib/dressRequirements";

const labels: Record<string, string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  changes_requested: "Cambios solicitados",
  approved: "Publicado",
  rejected: "Rechazado",
  archived: "Archivado",
  reserved: "Reservado",
  sold: "Vendido",
};

function cleanModel(value: any) {
  const text = String(value ?? "").trim();
  return /^(na|n\/a|no aplica|sin modelo)$/i.test(text) ? "" : text;
}

export default async function MyDresses() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("dresses")
    .select("*,dress_photos(id,storage_path,is_primary,position),orders(count)")
    .eq("seller_id", user.id)
    .is("removed_by_seller_at", null)
    .order("updated_at", { ascending: false });

  let brandNames: Awaited<ReturnType<typeof resolveDressBrandNames>> | null = null;
  let brandError = "";
  if (!error) {
    try {
      brandNames = await resolveDressBrandNames(supabase, data ?? []);
    } catch (e: any) {
      brandError = e?.message || "No fue posible cargar las marcas.";
    }
  }

  const dressIds=(data??[]).map((d:any)=>d.id);
  const [{data:activeOffers},{data:activePayments},{data:feedback}]=await Promise.all([
    dressIds.length?supabase.from("offers").select("dress_id").in("dress_id",dressIds).eq("status","pending"):Promise.resolve({data:[]} as any),
    dressIds.length?supabase.from("orders").select("dress_id").in("dress_id",dressIds).in("status",["payment_processing","payment_review"]):Promise.resolve({data:[]} as any),
    supabase.from("notifications").select("id,body,metadata,created_at").eq("user_id",user.id).eq("kind","dress_improvement_suggested").is("read_at",null).order("created_at",{ascending:false}),
  ]);
  const offerCounts=(activeOffers??[]).reduce((acc:any,o:any)=>{acc[o.dress_id]=(acc[o.dress_id]||0)+1;return acc;},{});
  const paymentDressIds=new Set((activePayments??[]).map((o:any)=>o.dress_id));
  const feedbackByDress=(feedback??[]).reduce((acc:any,n:any)=>{const id=n.metadata?.dress_id;if(id)(acc[id]??=[]).push(n);return acc;},{});
  const loadError = error?.message || brandError;

  return <main className="page">
    <div className="title-row"><h1>Mis vestidos</h1><Link className="btn btn-primary" href="/publicar">Publicar vestido</Link></div>
    {loadError && <div className="alert-error"><strong>No pudimos cargar tus publicaciones.</strong><p>{loadError}</p></div>}
    <div className="cards-list">
      {!loadError && (data ?? []).map((d: any) => {
        // Editable/eliminable mientras no haya una oferta aceptada (pedido activo)
        // sobre este vestido, y no esté ya reservado/vendido.
        const hasActivePayment=paymentDressIds.has(d.id);
        const editable = ["draft", "pending_review", "changes_requested", "rejected", "approved"].includes(d.status) && !hasActivePayment;
        const hasOrderHistory = (d.orders?.[0]?.count ?? 0) > 0;
        const brand = brandNames?.nameFor(d) ?? "Sin marca";
        const model = cleanModel(d.model);
        const photo=[...(d.dress_photos??[])].sort((a:any,b:any)=>(b.is_primary?1:0)-(a.is_primary?1:0)||a.position-b.position)[0];
        const missing=d.status==="draft"?missingDressRequirements(d):[];
        return <article className="panel my-dress-card" key={d.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo&&<img className="my-dress-photo" src={dressImageUrl(photo.storage_path)} alt={`${brand} ${model}`} />}
          <div className="my-dress-card-body">
          <h2>{brand}{model ? ` ${model}` : ""}</h2>
          <p><span className="badge">{labels[d.status] ?? d.status}</span></p>
          <p>{d.precio_venta_mxn ? `$${Number(d.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}</p>
          {d.status === "changes_requested" && <div className="alert-error"><strong>SECOND VOW solicitó cambios:</strong><p>{d.moderation_notes || "Revisa la publicación antes de reenviarla."}</p></div>}
          {d.status === "rejected" && <div className="alert-error"><strong>Publicación rechazada:</strong><p>{d.moderation_notes || "No se indicó un motivo."}</p></div>}
          {d.status === "approved" && <div className="alert-success">Tu vestido está publicado y visible en el marketplace.</div>}
          {!!offerCounts[d.id]&&<p><strong>{offerCounts[d.id]}</strong> oferta{offerCounts[d.id]===1?" activa":"s activas"}</p>}
          {!!missing.length&&<div className="alert-info"><strong>Para publicar falta:</strong> {missing.join(", ")}.</div>}
          {hasActivePayment&&<div className="alert-info">Hay un pago en proceso. La edición y eliminación se habilitarán si ese intento se cancela o vence.</div>}
          {(feedbackByDress[d.id]??[]).map((notice:any)=><div className="alert-info" key={notice.id}><strong>Sugerencia de SECOND VOW</strong><p>{notice.body}</p></div>)}
          {d.status === "reserved" && <div className="alert-info">Hay un pago en proceso sobre este vestido. No puede editarse hasta que se complete o se cancele.</div>}
          <div className="actions">
            {editable && <Link href={`/publicar/${d.id}`} className="btn btn-secondary">{d.status === "changes_requested" ? "Corregir publicación" : "Editar publicación"}</Link>}
            {editable && <DeleteDraftButton dressId={d.id} hasOrderHistory={hasOrderHistory} />}
            <Link href={`/vestidos/${d.id}`} className="btn btn-secondary">Ver</Link>
          </div>
          </div>
        </article>;
      })}
      {!loadError && !data?.length && <p>No tienes publicaciones todavía.</p>}
    </div>
  </main>;
}
