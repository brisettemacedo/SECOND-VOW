import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { resolveDressBrandNames } from "@/lib/server/dressBrands";

export const dynamic = "force-dynamic";

function cleanModel(value: any) {
  const text = String(value ?? "").trim();
  return /^(na|n\/a|no aplica|sin modelo)$/i.test(text) ? "" : text;
}

export default async function AdminPublicationsPage() {
  const { supabase } = await requireAdmin();
  const { data: dresses, error } = await supabase
    .from("dresses")
    .select("id,brand_id,brand_suggestion_id,model,status,created_at,updated_at,talla_etiqueta,precio_venta_mxn,dress_photos(id)")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  let resolver: Awaited<ReturnType<typeof resolveDressBrandNames>> | null = null;
  let brandError = "";
  if (!error) {
    try { resolver = await resolveDressBrandNames(supabase, dresses ?? []); }
    catch (e: any) { brandError = e?.message || "No fue posible cargar las marcas."; }
  }
  const loadError = error?.message || brandError;

  return (
    <main className="page">
      <div className="title-row">
        <div>
          <h1>Publicaciones por revisar</h1>
          <p className="muted">Solo se muestran vestidos enviados formalmente a revisión.</p>
        </div>
        <Link className="btn btn-secondary" href="/admin">Volver a administración</Link>
      </div>

      {loadError && <div className="alert-error"><strong>No pudimos cargar las publicaciones pendientes.</strong><p>{loadError}</p></div>}
      <div className="cards-list">
        {!loadError && (dresses ?? []).map((dress: any) => {
          const brand = resolver?.nameFor(dress) ?? "Marca pendiente";
          const model = cleanModel(dress.model);
          const photoCount = dress.dress_photos?.length ?? 0;
          return (
            <article className="panel" key={dress.id}>
              <div className="admin-publication-row">
                <div>
                  <span className="badge">En revisión</span>
                  <h2>{brand}{model ? ` ${model}` : ""}</h2>
                  <p className="muted">Talla {dress.talla_etiqueta ?? "No especificado"} | {photoCount} fotografías | {dress.precio_venta_mxn ? `$${Number(dress.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}</p>
                  <p className="muted">Enviado/actualizado: {new Date(dress.updated_at).toLocaleString("es-MX")}</p>
                </div>
                <Link className="btn btn-primary" href={`/admin/publicaciones/${dress.id}`}>Revisar publicación</Link>
              </div>
            </article>
          );
        })}
        {!loadError && !dresses?.length && <div className="panel"><p>No hay publicaciones pendientes de revisión.</p></div>}
      </div>
    </main>
  );
}
