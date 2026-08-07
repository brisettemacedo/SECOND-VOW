import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchDresses, type DressSearchParams } from "@/lib/dresses";
import { loadDressCatalogData } from "@/lib/dressCatalogData";
import DressCard, { type CatalogDress } from "@/components/DressCard";
import FilterSidebar from "@/components/FilterSidebar";

export const dynamic = "force-dynamic";

async function CatalogFilters() {
  const supabase = await createClient();
  const [{ data: brands }, catalogs] = await Promise.all([
    supabase.from("brands").select("id,name").eq("is_active", true).order("name", { ascending: true }),
    loadDressCatalogData(supabase),
  ]);
  return <FilterSidebar brands={brands ?? []} catalogs={catalogs} />;
}

async function CatalogResults({ searchParams }: { searchParams: DressSearchParams }) {
  const supabase = await createClient();
  const { dresses, count, page, totalPages, error } = await searchDresses(supabase, searchParams);

  if (error) return <div className="alert-error">No se pudo cargar el catálogo en este momento.</div>;
  if (dresses.length === 0) return <div className="catalog-empty"><h3>Ningún vestido coincide con esos filtros</h3><p>Prueba ampliando el rango de precio o quitando alguna opción.</p></div>;

  return <>
    <p className="catalog-count"><strong>{count}</strong> vestido{count === 1 ? "" : "s"} encontrado{count === 1 ? "" : "s"}</p>
    <div className="catalog-grid">{(dresses as unknown as CatalogDress[]).map(dress => <DressCard key={dress.id} dress={dress} />)}</div>
    {totalPages > 1 && <nav className="catalog-pagination" aria-label="Paginación del catálogo">
      {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => {
        const params = new URLSearchParams(searchParams as Record<string, string>);
        params.set("page", String(pageNumber));
        return <Link key={pageNumber} href={`/vestidos?${params.toString()}`} className={`btn catalog-page-button${pageNumber === page ? " active" : ""}`}>{pageNumber}</Link>;
      })}
    </nav>}
  </>;
}

export default function CatalogPage({ searchParams }: { searchParams: DressSearchParams }) {
  return <main className="catalog-page">
    <div className="catalog-heading-row">
      <div><p className="catalog-eyebrow">Encuentra el vestido indicado</p><h1>Vestidos disponibles</h1></div>
      <Suspense fallback={<div className="filter-trigger-placeholder" />}><CatalogFilters /></Suspense>
    </div>
    <Suspense fallback={<p className="muted">Cargando vestidos...</p>}><CatalogResults searchParams={searchParams} /></Suspense>
  </main>;
}
