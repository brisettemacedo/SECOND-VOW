import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { responseTimeLabel } from "@/lib/reputation";

export default async function Seller({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("public_profiles").select("id,identity_verified,response_time_minutes,rating_average").eq("id", id).maybeSingle();
  if (!profile) notFound();
  return <main className="page narrow"><section className="panel seller-public"><h1>Perfil de vendedora</h1><p><strong>{profile.identity_verified ? "Identidad verificada" : "Identidad pendiente"}</strong></p><p>Tiempo habitual de respuesta: {responseTimeLabel(profile.response_time_minutes)}</p><p>Calificación: {profile.rating_average ? `${Number(profile.rating_average).toFixed(1)} de 5` : "Aún sin calificaciones"}</p></section></main>;
}
