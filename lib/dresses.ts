import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 24;

// Columnas explícitas para el catálogo público | nunca "select *" desde
// el cliente (sección 6/18 de la especificación). Se excluyen a propósito
// moderation_notes, moderated_by, moderated_at y cualquier dato interno.
const CATALOG_COLUMNS = `
  id, model, talla_etiqueta, silueta, escote, espalda, manga,
  tela_principal, color_principal, cola, condicion,
  precio_original_mxn, precio_venta_mxn,
  envio_nacional, status, created_at,
  brands ( name ),
  dress_photos ( storage_path, is_primary, position )
`;

export type DressSearchParams = {
  silueta?: string;
  escote?: string;
  espalda?: string;
  manga?: string;
  tela?: string;
  color?: string;
  condicion?: string;
  brand?: string;
  talla?: string;
  precio_min?: string;
  precio_max?: string;
  sort?: string; // "recientes" | "precio-asc" | "precio-desc" | "descuento"
  page?: string;
};

function multi(value?: string): string[] | null {
  if (!value) return null;
  const parts = value.split(",").filter(Boolean);
  return parts.length ? parts : null;
}

export async function searchDresses(
  supabase: SupabaseClient,
  params: DressSearchParams
) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("dresses")
    .select(CATALOG_COLUMNS, { count: "exact" })
    .eq("status", "approved");

  const silueta = multi(params.silueta);
  if (silueta) query = query.in("silueta", silueta);

  const escote = multi(params.escote);
  if (escote) query = query.in("escote", escote);

  const espalda = multi(params.espalda);
  if (espalda) query = query.in("espalda", espalda);

  const manga = multi(params.manga);
  if (manga) query = query.in("manga", manga);

  const tela = multi(params.tela);
  if (tela) query = query.in("tela_principal", tela);

  const color = multi(params.color);
  if (color) query = query.in("color_principal", color);

  const condicion = multi(params.condicion);
  if (condicion) query = query.in("condicion", condicion);

  if (params.brand) query = query.eq("brand_id", params.brand);

  const talla = multi(params.talla);
  if (talla) query = query.in("talla_etiqueta", talla);

  if (params.precio_min) query = query.gte("precio_venta_mxn", Number(params.precio_min));
  if (params.precio_max) query = query.lte("precio_venta_mxn", Number(params.precio_max));


  switch (params.sort) {
    case "precio-asc":
      query = query.order("precio_venta_mxn", { ascending: true });
      break;
    case "precio-desc":
      query = query.order("precio_venta_mxn", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  return {
    dresses: data ?? [],
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: count ? Math.ceil(count / PAGE_SIZE) : 0,
    error,
  };
}
