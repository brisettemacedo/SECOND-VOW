import Link from "next/link";
import { requireUser } from "@/lib/auth";

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

export default async function MyDresses() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("dresses")
    .select("id,model,status,updated_at,precio_venta_mxn,moderation_notes,moderated_at,brands(name),brand_suggestions(suggested_name)")
    .eq("seller_id", user.id)
    .order("updated_at", { ascending: false });

  return <main className="page">
    <div className="title-row"><h1>Mis vestidos</h1><Link className="btn btn-primary" href="/publicar">Publicar vestido</Link></div>
    <div className="cards-list">
      {(data ?? []).map((d: any) => {
        const editable = ["draft", "changes_requested", "rejected"].includes(d.status);
        const brandRel = Array.isArray(d.brands) ? d.brands[0] : d.brands;
        const suggestionRel = Array.isArray(d.brand_suggestions) ? d.brand_suggestions[0] : d.brand_suggestions;
        const brand = brandRel?.name ?? suggestionRel?.suggested_name ?? "Sin marca";
        return <article className="panel" key={d.id}>
          <h2>{brand} {d.model ?? ""}</h2>
          <p><span className="badge">{labels[d.status] ?? d.status}</span></p>
          <p>{d.precio_venta_mxn ? `$${Number(d.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}</p>
          {d.status === "pending_review" && <div className="alert-success">Tu vestido está en revisión administrativa. No necesitas hacer nada por ahora.</div>}
          {d.status === "changes_requested" && <div className="alert-error"><strong>SECOND VOW solicitó cambios:</strong><p>{d.moderation_notes || "Revisa la publicación antes de reenviarla."}</p></div>}
          {d.status === "rejected" && <div className="alert-error"><strong>Publicación rechazada:</strong><p>{d.moderation_notes || "No se indicó un motivo."}</p></div>}
          {d.status === "approved" && <div className="alert-success">Tu vestido está publicado y visible en el marketplace.</div>}
          <div className="actions">
            {editable && <Link href={`/publicar/${d.id}`} className="btn btn-secondary">{d.status === "changes_requested" ? "Corregir y reenviar" : "Editar"}</Link>}
            <Link href={`/vestidos/${d.id}`} className="btn btn-secondary">Ver</Link>
          </div>
        </article>;
      })}
      {!data?.length && <p>No tienes publicaciones todavía.</p>}
    </div>
  </main>;
}
