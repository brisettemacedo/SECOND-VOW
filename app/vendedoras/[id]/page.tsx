import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DressCard, { type CatalogDress } from "@/components/DressCard";

export const dynamic = "force-dynamic";

export default async function SellerProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  // Solo columnas públicas — nunca correo, teléfono, ni datos de moderación.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, city, avatar_url, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const { data: dresses } = await supabase
    .from("dresses")
    .select(`
      id, model, talla_etiqueta, silueta, condicion, precio_original_mxn,
      precio_venta_mxn, ciudad, estado, envio_nacional,
      brands ( name ), dress_photos ( storage_path, is_primary, position )
    `)
    .eq("seller_id", params.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  const memberSince = new Date(profile.created_at).toLocaleDateString("es-MX", {
    year: "numeric", month: "long",
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>{profile.full_name ?? "Vendedora"}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>
          {profile.city ? `${profile.city} · ` : ""}En SecondVow desde {memberSince}
          {" · "}{(dresses ?? []).length} publicación{(dresses ?? []).length === 1 ? "" : "es"} activa{(dresses ?? []).length === 1 ? "" : "s"}
        </p>
      </div>

      {(dresses ?? []).length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>Esta vendedora no tiene publicaciones activas por ahora.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {(dresses as unknown as CatalogDress[]).map((d) => (
            <DressCard key={d.id} dress={d} />
          ))}
        </div>
      )}
    </main>
  );
}
