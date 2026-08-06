import DressPublishForm from "@/components/DressPublishForm";
import { requireUser } from "@/lib/auth";
export default async function PublishPage(){ const {supabase,user}=await requireUser(); const {data:brands}=await supabase.from("brands").select("id,name").eq("is_active",true).order("name"); return <main className="page"><DressPublishForm brands={brands??[]} userId={user.id}/></main> }
