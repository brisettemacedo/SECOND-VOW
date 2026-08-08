import {requireAdmin} from "@/lib/auth";import AdminDashboard from "@/components/AdminDashboard";
export default async function Admin(){const {supabase}=await requireAdmin();const [{data:dresses},{data:verifications},{data:claims},{data:brands},{data:suggestions},{data:users},{data:reports},{data:arco}]=await Promise.all([
  supabase.from("dresses").select("id,model,status,seller_id,created_at").in("status",["pending_review","changes_requested"]).order("created_at"),
  supabase.from("identity_verifications").select("id,user_id,legal_name,document_path,status,document_type,created_at").eq("status","pending").order("created_at"),
  supabase.from("claims").select("id,order_id,reason,description,status,created_at").in("status",["open","under_review"]).order("created_at"),
  supabase.from("brands").select("id,name").eq("is_active",true).order("name"),
  supabase.from("brand_suggestions").select("id,suggested_name,seller_id,status,created_at").eq("status","pending").order("created_at"),
  supabase.from("profiles").select("id,full_name,role,is_blocked,blocked_reason,created_at").neq("role","admin").order("created_at",{ascending:false}).limit(100),
  supabase.from("conversation_reports").select("id,conversation_id,reporter_id,reason_code,details,status,created_at").in("status",["open","under_review"]).order("created_at",{ascending:false}),
  supabase.from("arco_requests").select("id,user_id,request_type,description,status,admin_response,created_at").in("status",["received","in_review","needs_information"]).order("created_at")
]);return <main className="page"><h1>Administración</h1><AdminDashboard dresses={dresses??[]} verifications={verifications??[]} claims={claims??[]} brands={brands??[]} suggestions={suggestions??[]} users={users??[]} reports={reports??[]} arco={arco??[]}/></main>}
