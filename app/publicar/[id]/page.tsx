import { notFound } from "next/navigation";
import DressPublishForm from "@/components/DressPublishForm";
import { requireUser } from "@/lib/auth";
import { loadDressCatalogData } from "@/lib/dressCatalogData";

export default async function EditDress({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  const [{ data: dress }, { data: brands }, catalogs] = await Promise.all([
    supabase
      .from("dresses")
      .select("*,dress_photos(*),dress_characteristics(characteristic_id),brand_suggestions(suggested_name,status)")
      .eq("id", params.id)
      .eq("seller_id", user.id)
      .maybeSingle(),
    supabase.from("brands").select("id,name").eq("is_active", true).order("name"),
    loadDressCatalogData(supabase),
  ]);

  if (!dress) notFound();

  return (
    <main className="page">
      <DressPublishForm initialDress={dress} brands={brands ?? []} catalogs={catalogs} userId={user.id} />
    </main>
  );
}
