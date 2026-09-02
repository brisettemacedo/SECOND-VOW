import { notFound } from "next/navigation";
import DressPublishForm from "@/components/DressPublishForm";
import { requireUser } from "@/lib/auth";
import { loadDressCatalogData } from "@/lib/dressCatalogData";

export default async function EditDress({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  const { id } = await params;
  if (!id) notFound();

  const [{ data: dress, error: dressError }, { data: brands }, { data: activePayment }, catalogs] = await Promise.all([
    supabase
      .from("dresses")
      .select("*,dress_photos(*),dress_characteristics(characteristic_id),dress_declarations(*)")
      .eq("id", id)
      .eq("seller_id", user.id)
      .maybeSingle(),
    supabase.from("brands").select("id,name").eq("is_active", true).order("name"),
    supabase.from("orders").select("id").eq("dress_id",id).in("status",["payment_processing","payment_review"]).limit(1).maybeSingle(),
    loadDressCatalogData(supabase),
  ]);

  if (dressError || !dress) notFound();

  if (activePayment) return <main className="page narrow"><div className="alert-info"><strong>Esta publicación tiene un pago en proceso.</strong><p>No puede editarse mientras Stripe confirma, cancela o vence ese intento. El bloqueo se quitará automáticamente cuando termine.</p></div></main>;

  let suggestion = null;
  if (dress.brand_suggestion_id) {
    const { data, error } = await supabase
      .from("brand_suggestions")
      .select("id,suggested_name,status")
      .eq("id", dress.brand_suggestion_id)
      .maybeSingle();
    if (!error) suggestion = data;
  }

  const initialDress = { ...dress, brand_suggestions: suggestion };

  return (
    <main className="page">
      <DressPublishForm initialDress={initialDress} brands={brands ?? []} catalogs={catalogs} userId={user.id} />
    </main>
  );
}
