import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { searchDresses, type DressSearchParams } from "@/lib/dresses";
import { loadDressCatalogData } from "@/lib/dressCatalogData";
import { type CatalogDress } from "@/components/DressCard";
import FilterSidebar from "@/components/FilterSidebar";
import InfiniteDressGrid from "@/components/InfiniteDressGrid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vestidos de novia de segunda mano en México",
  description: "Explora vestidos de novia de segunda mano y vestidos nuevos sin usar en México. Filtra por talla, marca, silueta, condición y precio.",
  alternates: { canonical: "/vestidos" },
  openGraph: {
    title: "Vestidos de novia de segunda mano en México",
    description: "Encuentra vestidos de novia usados y nuevos sin usar, con precios y detalles claros.",
    url: "/vestidos",
  },
};

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

  const filters = Object.fromEntries(Object.entries(firstPageParams).filter(([, value]) => typeof value === "string")) as Record<string, string>;
  return <>
    <p className="catalog-count"><strong>{count}</strong> vestido{count === 1 ? "" : "s"} encontrado{count === 1 ? "" : "s"}</p>
    <InfiniteDressGrid initialDresses={dresses as unknown as CatalogDress[]} total={count} filters={filters} />
  </>;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<DressSearchParams> }) {
  const query = await searchParams;
  return <main className="catalog-page">
    <div className="catalog-heading-row">
      <div><p className="catalog-eyebrow">Encuentra el vestido indicado</p><h1>Vestidos de novia de segunda mano en México</h1><p className="catalog-intro">Vestidos usados y nuevos sin usar, publicados directamente por sus dueñas.</p></div>
      <Suspense fallback={<div className="filter-trigger-placeholder" />}><CatalogFilters /></Suspense>
    </div>
    <Suspense fallback={<p className="muted">Cargando vestidos...</p>}><CatalogResults searchParams={query} /></Suspense>
    <section className="catalog-seo-copy" aria-labelledby="catalog-guide-title">
      <h2 id="catalog-guide-title">Encuentra un vestido de novia usado que se sienta hecho para ti</h2>
      <p>Compara marcas, tallas, siluetas, telas, condición y precio. Cada publicación muestra los detalles declarados por la vendedora para que puedas preguntar, negociar y decidir con más claridad.</p>
      <div>
        <article><h3>Compra con información clara</h3><p>Pregunta medidas, ajustes e imperfecciones directamente en el chat antes de aceptar una oferta.</p></article>
        <article><h3>Envíos dentro de México</h3><p>La vendedora cotiza el envío según tu destino y comparte una guía con rastreo después del pago.</p></article>
        <article><h3>¿Tienes un vestido guardado?</h3><p><a href="/vender-vestido-de-novia">Publica tu vestido de novia gratis</a> y encuentra a su próxima novia.</p></article>
      </div>
    </section>
  </main>;
}
