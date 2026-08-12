import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DressCard, { type CatalogDress } from "@/components/DressCard";
import { STATUS_LABELS } from "@/lib/catalogs";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/favoritos");
  }

  const { data: favorites, error } = await supabase
    .from("favorites")
    .select(`
      created_at,
      dresses (
        id, model, talla_etiqueta, silueta, condicion, precio_original_mxn,
        precio_venta_mxn, envio_nacional, status,
        brands ( name ), dress_photos ( storage_path, is_primary, position )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div className="alert-error">No se pudieron cargar tus favoritos. Intenta de nuevo.</div>
      </main>
    );
  }

  const items = (favorites ?? []).map((f: any) => (Array.isArray(f.dresses) ? f.dresses[0] : f.dresses)).filter(Boolean);

  const disponibles = items.filter((d: any) => d.status === "approved");
  const noDisponibles = items.filter((d: any) => d.status !== "approved");

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Vestidos guardados</h1>

      {items.length === 0 && (
        <p style={{ color: "var(--color-text-muted)" }}>
          Todavía no has guardado ningún vestido. <Link href="/vestidos">Explora el catálogo</Link>.
        </p>
      )}

      {disponibles.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
          {(disponibles as unknown as CatalogDress[]).map((d) => (
            <DressCard key={d.id} dress={d} />
          ))}
        </div>
      )}

      {noDisponibles.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Ya no disponibles
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {noDisponibles.map((d: any) => (
              <div
                key={d.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", border: "1px solid var(--color-border)", borderRadius: 4,
                  color: "var(--color-text-muted)", fontSize: 13.5,
                }}
              >
                <span>{d.model || "Vestido guardado"}</span>
                <span>{STATUS_LABELS[d.status] ?? d.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
