import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { searchDresses, type DressSearchParams } from "@/lib/dresses";
import { loadDressCatalogData } from "@/lib/dressCatalogData";
import { type CatalogDress } from "@/components/DressCard";
import FilterSidebar from "@/components/FilterSidebar";
import { signDressCollections } from "@/lib/server/dressImageUrls";
import InfiniteDressGrid from "@/components/InfiniteDressGrid";

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
  const firstPageParams = { ...searchParams, page: "1" };
  const { dresses, count, error } = await searchDresses(supabase, firstPageParams);

  if (error) return <div className="alert-error">No se pudo cargar el catálogo en este momento.</div>;
  if (dresses.length === 0) return <div className="catalog-empty"><h3>Ningún vestido coincide con esos filtros</h3><p>Prueba ampliando el rango de precio o quitando alguna opción.</p></div>;

  const signedDresses = await signDressCollections(dresses as any[]);
  const filters = Object.fromEntries(Object.entries(firstPageParams).filter(([, value]) => typeof value === "string")) as Record<string, string>;
  return <>
    <p className="catalog-count"><strong>{count}</strong> vestido{count === 1 ? "" : "s"} encontrado{count === 1 ? "" : "s"}</p>
    <InfiniteDressGrid initialDresses={signedDresses as unknown as CatalogDress[]} total={count} filters={filters} />
  </>;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<DressSearchParams> }) {
  const query = await searchParams;
  return <main className="catalog-page">
    <div className="catalog-heading-row">
      <div><p className="catalog-eyebrow">Encuentra el vestido indicado</p><h1>Vestidos disponibles</h1></div>
      <Suspense fallback={<div className="filter-trigger-placeholder" />}><CatalogFilters /></Suspense>
    </div>
    <Suspense fallback={<p className="muted">Cargando vestidos...</p>}><CatalogResults searchParams={query} /></Suspense>
  </main>;
}
