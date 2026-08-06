import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchDresses, type DressSearchParams } from "@/lib/dresses";
import DressCard, { type CatalogDress } from "@/components/DressCard";
import FilterSidebar from "@/components/FilterSidebar";

export const dynamic = "force-dynamic"; // los filtros dependen de la URL en cada visita

async function CatalogResults({ searchParams }: { searchParams: DressSearchParams }) {
  const supabase = await createClient();
  const { dresses, count, page, totalPages, error } = await searchDresses(supabase, searchParams);

  if (error) {
    return (
      <div className="alert-error">
        No se pudo cargar el catálogo en este momento. Intenta de nuevo en unos segundos.
      </div>
    );
  }

  if (dresses.length === 0) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
        <h3 style={{ marginBottom: 8 }}>Ningún vestido coincide con esos filtros</h3>
        <p>Prueba ampliando el rango de precio o quitando alguna opción.</p>
      </div>
    );
  }

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 16 }}>
        <strong style={{ color: "var(--color-text-primary)" }}>{count}</strong> vestido{count === 1 ? "" : "s"} encontrado{count === 1 ? "" : "s"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
        {(dresses as unknown as CatalogDress[]).map((d) => (
          <DressCard key={d.id} dress={d} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 32 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params = new URLSearchParams(searchParams as Record<string, string>);
            params.set("page", String(p));
            return (
              <Link
                key={p}
                href={`/vestidos?${params.toString()}`}
                className="btn"
                style={{
                  border: "1px solid var(--color-border)",
                  background: p === page ? "var(--color-action-primary)" : "transparent",
                  color: p === page ? "var(--color-action-on-primary)" : "inherit",
                  padding: "8px 14px",
                }}
              >
                {p}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

export default function CatalogPage({
  searchParams,
}: {
  searchParams: DressSearchParams;
}) {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Vestidos disponibles</h1>

      <div className="catalog-layout" style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <Suspense fallback={<div style={{ width: 260 }} />}>
          <FilterSidebar />
        </Suspense>

        <div style={{ flex: 1 }}>
          <Suspense fallback={<p style={{ color: "var(--color-text-muted)" }}>Cargando vestidos...</p>}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
