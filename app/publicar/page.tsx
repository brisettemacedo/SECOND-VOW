import DressPublishForm from "@/components/DressPublishForm";
import { requireUser } from "@/lib/auth";
import { loadDressCatalogData } from "@/lib/dressCatalogData";

export default async function PublishPage() {
  const { supabase, user } = await requireUser();
  const [{ data: brands }, catalogs] = await Promise.all([
    supabase.from("brands").select("id,name").eq("is_active", true).order("name"),
    loadDressCatalogData(supabase),
  ]);

  return (
    <main className="page">
      <DressPublishForm brands={brands ?? []} catalogs={catalogs} userId={user.id} />
    </main>
  );
}
