import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const { supabase } = await requireAdmin();
  const [
    { count: pendingPublications },
    { data: verifications },
    { data: claims },
    { data: brands },
    { data: suggestions },
    { data: users },
    { data: reports },
    { data: arco },
  ] = await Promise.all([
    supabase.from("dresses").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
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
    <section className="admin-primary-card panel">
      <div>
        <span className="badge">{pendingPublications ?? 0} pendientes</span>
        <h2>Publicaciones</h2>
        <p>Revisa toda la información y fotografías antes de publicar un vestido.</p>
      </div>
      <Link href="/admin/publicaciones" className="btn btn-primary">Revisar publicaciones</Link>
    </section>
    <AdminDashboard verifications={verifications??[]} claims={claims??[]} brands={brands??[]} suggestions={suggestions??[]} users={users??[]} reports={reports??[]} arco={arco??[]} />
  </main>;
}
