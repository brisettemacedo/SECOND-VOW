import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const { supabase } = await requireAdmin();
  const [
    { data: pendingPublications },
    { data: verifications },
    { data: claims },
    { data: brands },
    { data: suggestions },
    { data: users },
    { data: reports },
    { data: arco },
  ] = await Promise.all([
    supabase.from("dresses")
      .select("id,model,status,updated_at,talla_etiqueta,precio_venta_mxn,brands(name),brand_suggestions(suggested_name,status),dress_photos(id)")
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

  return <main className="page">
    <div className="title-row"><h1>Administración</h1></div>
    <section className="panel admin-pending-overview">
      <div className="title-row">
        <div>
          <span className="badge">{pendingPublications?.length ?? 0} pendientes</span>
          <h2>Publicaciones pendientes</h2>
          <p>Abre cada solicitud para revisar todos los datos y fotografías antes de aprobarla.</p>
        </div>
        <Link href="/admin/publicaciones" className="btn btn-secondary">Ver todas</Link>
      </div>

      <div className="cards-list admin-pending-list">
        {(pendingPublications ?? []).slice(0, 5).map((dress: any) => {
          const brandRel = Array.isArray(dress.brands) ? dress.brands[0] : dress.brands;
          const suggestionRel = Array.isArray(dress.brand_suggestions) ? dress.brand_suggestions[0] : dress.brand_suggestions;
          const brand = brandRel?.name ?? suggestionRel?.suggested_name ?? "Marca pendiente";
          return <article className="admin-publication-row admin-publication-preview" key={dress.id}>
            <div>
              <span className="badge">En revisión</span>
              <h3>{brand}{dress.model && !/^(na|n\/a|no aplica|sin modelo)$/i.test(String(dress.model).trim()) ? ` ${dress.model}` : ""}</h3>
              <p className="muted">
                Talla {dress.talla_etiqueta || "—"} · {(dress.dress_photos ?? []).length} fotografías · {dress.precio_venta_mxn ? `$${Number(dress.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}
              </p>
            </div>
            <Link href={`/admin/publicaciones/${dress.id}`} className="btn btn-primary">Revisar solicitud completa</Link>
          </article>;
        })}
        {!pendingPublications?.length && <p>No hay publicaciones pendientes.</p>}
      </div>
    </section>
    <AdminDashboard verifications={verifications??[]} claims={claims??[]} brands={brands??[]} suggestions={suggestions??[]} users={users??[]} reports={reports??[]} arco={arco??[]} />
  </main>;
}
