import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { responseTimeLabel } from "@/lib/reputation";

export default async function Seller({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: profile },{data:reviews}] = await Promise.all([supabase.from("public_profiles").select("id,display_name,identity_verified,response_time_minutes,rating_average,rating_count,completed_sales_count").eq("id", id).maybeSingle(),supabase.from("public_seller_reviews").select("id,rating,comment,created_at").eq("reviewee_id",id).order("created_at",{ascending:false}).limit(20)]);
  if (!profile) notFound();
  return <main className="page narrow"><section className="panel seller-public"><h1>{profile.display_name || "Vendedora"}</h1><p className="muted">Perfil de vendedora</p><p><strong>{profile.identity_verified ? "Identidad verificada" : "Identidad pendiente"}</strong></p><p>Tiempo habitual de respuesta: {responseTimeLabel(profile.response_time_minutes)}</p><p>Calificación: {profile.rating_average ? `${Number(profile.rating_average).toFixed(1)} de 5 (${profile.rating_count||0})` : "Aún sin calificaciones"}</p><p>Ventas concluidas sin reclamación activa: {profile.completed_sales_count||0}</p></section>{(reviews??[]).length>0&&<section className="panel"><h2>Opiniones de compradoras</h2>{reviews?.map((review:any)=><article key={review.id} className="review"><strong>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</strong>{review.comment&&<p>{review.comment}</p>}<small>Compra verificada · {new Date(review.created_at).toLocaleDateString("es-MX")}</small></article>)}</section>}</main>;
}
