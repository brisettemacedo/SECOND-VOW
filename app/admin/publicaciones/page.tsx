import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPublicationsPage() {
  const { supabase } = await requireAdmin();
  const { data: dresses, error } = await supabase
    .from("dresses")
    .select("id,model,status,created_at,updated_at,talla_etiqueta,precio_venta_mxn,brands(name),brand_suggestions(suggested_name,status),dress_photos(id)")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  return (
    <main className="page">
      <div className="title-row">
        <div>
          <h1>Publicaciones por revisar</h1>
          <p className="muted">Solo se muestran vestidos enviados formalmente a revisión.</p>
        </div>
        <Link className="btn btn-secondary" href="/admin">Volver a administración</Link>
      </div>

      {error && <div className="alert-error">{error.message}</div>}
      <div className="cards-list">
        {(dresses ?? []).map((dress: any) => {
          const brandRel = Array.isArray(dress.brands) ? dress.brands[0] : dress.brands;
          const suggestionRel = Array.isArray(dress.brand_suggestions) ? dress.brand_suggestions[0] : dress.brand_suggestions;
          const brand = brandRel?.name ?? suggestionRel?.suggested_name ?? "Marca pendiente";
          const photoCount = dress.dress_photos?.length ?? 0;
          return (
            <article className="panel" key={dress.id}>
              <div className="admin-publication-row">
                <div>
                  <span className="badge">En revisión</span>
                  <h2>{brand} {dress.model ?? ""}</h2>
                  <p className="muted">Talla {dress.talla_etiqueta ?? "—"} · {photoCount} fotografías · {dress.precio_venta_mxn ? `$${Number(dress.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}</p>
                  <p className="muted">Enviado/actualizado: {new Date(dress.updated_at).toLocaleString("es-MX")}</p>
                </div>
                <Link className="btn btn-primary" href={`/admin/publicaciones/${dress.id}`}>Revisar publicación</Link>
              </div>
            </article>
          );
        })}
        {!dresses?.length && <div className="panel"><p>No hay publicaciones pendientes de revisión.</p></div>}
      </div>
    </main>
  );
}
