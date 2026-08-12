import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminDashboard from "@/components/AdminDashboard";
import { resolveDressBrandNames } from "@/lib/server/dressBrands";

export const dynamic = "force-dynamic";

function cleanModel(value: any) {
  const text = String(value ?? "").trim();
  return /^(na|n\/a|no aplica|sin modelo)$/i.test(text) ? "" : text;
}

export default async function Admin() {
  const { supabase } = await requireAdmin();
  const [
    pendingResult,
    { data: verifications },
    { data: claims },
    { data: brands },
    { data: suggestions },
    { data: users },
    { data: reports },
    { data: arco },
  ] = await Promise.all([
    supabase.from("dresses")
      .select("id,brand_id,brand_suggestion_id,model,status,updated_at,talla_etiqueta,precio_venta_mxn,dress_photos(id)")
      .eq("status", "pending_review")
      .order("updated_at", { ascending: true }),
    supabase.from("identity_verifications").select("id,user_id,legal_name,document_path,status,document_type,created_at").eq("status","pending").order("created_at"),
    supabase.from("claims").select("id,order_id,reason,description,status,created_at").in("status",["open","under_review"]).order("created_at"),
    supabase.from("brands").select("id,name").eq("is_active",true).order("name"),
    supabase.from("brand_suggestions").select("id,suggested_name,seller_id,status,created_at").eq("status","pending").order("created_at"),
    supabase.from("profiles").select("id,full_name,role,is_blocked,blocked_reason,created_at").neq("role","admin").order("created_at",{ascending:false}).limit(100),
    supabase.from("conversation_reports").select("id,conversation_id,reporter_id,reason_code,details,status,created_at").in("status",["open","under_review"]).order("created_at",{ascending:false}),
    supabase.from("arco_requests").select("id,user_id,request_type,description,status,admin_response,created_at").in("status",["received","in_review","needs_information"]).order("created_at"),
  ]);

  const pendingPublications = pendingResult.data ?? [];
  let pendingError = pendingResult.error?.message || "";
  let resolver: Awaited<ReturnType<typeof resolveDressBrandNames>> | null = null;
  if (!pendingError) {
    try { resolver = await resolveDressBrandNames(supabase, pendingPublications); }
    catch (e: any) { pendingError = e?.message || "No fue posible cargar las marcas."; }
  }

  return <main className="page">
    <div className="title-row"><h1>Administración</h1></div>
    <section className="panel admin-pending-overview">
      <div className="title-row">
        <div>
          <span className="badge">{pendingError ? "Error" : `${pendingPublications.length} pendientes`}</span>
          <h2>Publicaciones pendientes</h2>
          <p>Abre cada solicitud para revisar todos los datos y fotografías antes de aprobarla.</p>
        </div>
        <Link href="/admin/publicaciones" className="btn btn-secondary">Ver todas</Link>
      </div>

      {pendingError && <div className="alert-error"><strong>No pudimos cargar las publicaciones pendientes.</strong><p>{pendingError}</p></div>}
      <div className="cards-list admin-pending-list">
        {!pendingError && pendingPublications.slice(0, 5).map((dress: any) => {
          const brand = resolver?.nameFor(dress) ?? "Marca pendiente";
          const model = cleanModel(dress.model);
          return <article className="admin-publication-row admin-publication-preview" key={dress.id}>
            <div>
              <span className="badge">En revisión</span>
              <h3>{brand}{model ? ` ${model}` : ""}</h3>
              <p className="muted">
                Talla {dress.talla_etiqueta || "No especificado"} | {(dress.dress_photos ?? []).length} fotografías | {dress.precio_venta_mxn ? `$${Number(dress.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}
              </p>
            </div>
            <Link href={`/admin/publicaciones/${dress.id}`} className="btn btn-primary">Revisar solicitud completa</Link>
          </article>;
        })}
        {!pendingError && !pendingPublications.length && <p>No hay publicaciones pendientes.</p>}
      </div>
    </section>
    <AdminDashboard verifications={verifications??[]} claims={claims??[]} brands={brands??[]} suggestions={suggestions??[]} users={users??[]} reports={reports??[]} arco={arco??[]} />
  </main>;
}
