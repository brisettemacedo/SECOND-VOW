import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DressGallery from "@/components/DressGallery";
import DressCard, { type CatalogDress } from "@/components/DressCard";
import FavoriteButton from "@/components/FavoriteButton";
import ContactSellerButton from "@/components/ContactSellerButton";
import OfferButton from "@/components/OfferButton";
import {
  SILUETAS, ESCOTES, ESPALDAS, MANGAS, TELAS, COLORES, COLAS, CONDICIONES, STATUS_LABELS,
} from "@/lib/catalogs";
import { signDressCollections, signDressPhotos } from "@/lib/server/dressImageUrls";

export const dynamic = "force-dynamic";

function labelFor(list: { value: string; label: string }[], value: string | null) {
  if (!value) return "No especificado";
  return list.find((o) => o.value === value)?.label ?? value;
}

function fmtPrice(v: number | null) {
  if (v === null) return "No especificado";
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

export default async function DressDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  if (!id) notFound();
  const { data: { user } } = await supabase.auth.getUser();

  // Si el pago de este vestido quedó abandonado, libéralo antes de leer su estado.
  try {
    await supabase.rpc("expire_dress_reservation_if_stale", { p_dress_id: id });
  } catch {}

  const { data: dress, error } = await supabase
    .from("dresses")
    .select(`
      id, model, collection, year_approx, talla_etiqueta, sistema_talla,
      busto_cm, cintura_cm, cadera_cm, largo_hombro_piso_cm,
      altura_persona_cm, altura_tacon_cm, puede_ampliarse, puede_reducirse,
      silueta, escote, espalda, manga, tela_principal, tela_secundaria,
      color_principal, color_forro, cola, cola_largo_cm,
      condicion, tiene_manchas, tiene_jalones, tiene_roturas, dano_dobladillo,
      falta_aplicaciones, tiene_reparaciones, tiene_decoloracion, descripcion_danos,
      tuvo_ajustes, ajustes_detalle,
      precio_original_mxn, precio_venta_mxn,
      envio_nacional,
      descripcion, status, created_at, seller_id,
      brands ( name ), brand_suggestions!dresses_brand_suggestion_id_fkey ( suggested_name ),
      dress_photos ( id, storage_path, is_primary, position, classification ),
      dress_characteristics ( characteristics ( id, label ) )
    `)
    .eq("id", id)
    .is("removed_by_seller_at", null)
    .maybeSingle();

  if (error || !dress) {
    notFound();
  }

  const photos = (await signDressPhotos([...(dress.dress_photos ?? [])])).sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return a.position - b.position;
  });

  const brandName = Array.isArray(dress.brands)
    ? (dress.brands as any[])[0]?.name
    : (dress.brands as any)?.name;
  const suggestedBrand = Array.isArray((dress as any).brand_suggestions)
    ? (dress as any).brand_suggestions[0]?.suggested_name
    : (dress as any).brand_suggestions?.suggested_name;
  const displayBrand = brandName || (suggestedBrand ? `${suggestedBrand} (marca en confirmación)` : "Marca no especificada");
  const { data: seller } = await supabase
    .from("public_profiles")
    .select("id, display_name, identity_verified, response_time_minutes, rating_average")
    .eq("id", dress.seller_id)
    .maybeSingle();
  const characteristics = (dress.dress_characteristics ?? [])
    .map((dc: any) => (Array.isArray(dc.characteristics) ? dc.characteristics[0] : dc.characteristics))
    .filter(Boolean);

  const { data: similares } = await supabase
    .from("dresses")
    .select(`
      id, model, talla_etiqueta, silueta, condicion, precio_original_mxn,
      precio_venta_mxn, envio_nacional,
      brands ( name ), brand_suggestions!dresses_brand_suggestion_id_fkey ( suggested_name ), dress_photos ( storage_path, is_primary, position )
    `)
    .eq("status", "approved")
    .is("removed_by_seller_at", null)
    .eq("silueta", dress.silueta)
    .neq("id", dress.id)
    .limit(4);
  const similaresFirmados = await signDressCollections((similares ?? []) as any[]);

  const isOwnerOrAdminPreview = ["draft", "pending_review", "changes_requested", "rejected", "archived"].includes(dress.status);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      {isOwnerOrAdminPreview && (
        <div className="alert-error" style={{ marginBottom: 20 }}>
          Vista previa: esta publicación está en estado &quot;{STATUS_LABELS[dress.status]}&quot; y todavía no es visible públicamente.
        </div>
      )}
      {dress.status === "reserved" && (
        <div className="alert-info" style={{ marginBottom: 20 }}>
          Pago pendiente: alguien ya está comprando este vestido. Si el pago no se completa, volverá a estar disponible.
        </div>
      )}
      {dress.status === "sold" && (
        <div className="alert-error" style={{ marginBottom: 20 }}>
          Este vestido ya fue vendido y no está disponible para compra.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 40 }}>
        <DressGallery photos={photos} alt={displayBrand} />

        {/* Datos */}
        <div>
          <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-action-primary)" }}>
            {displayBrand}
          </div>
          <h1 style={{ fontSize: 26, margin: "6px 0 4px" }}>{dress.model && !/^(na|n\/a|no aplica|sin modelo)$/i.test(String(dress.model).trim()) ? dress.model : labelFor(SILUETAS, dress.silueta)}</h1>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "14px 0 20px" }}>
            {dress.precio_original_mxn && (
              <span style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "line-through" }}>
                {fmtPrice(dress.precio_original_mxn)}
              </span>
            )}
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 600 }}>
              {fmtPrice(dress.precio_venta_mxn)}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginBottom: 24 }}>
            <tbody>
              {[
                ["Talla (etiqueta)", `${dress.talla_etiqueta} (${dress.sistema_talla})`],
                ["Silueta", labelFor(SILUETAS, dress.silueta)],
                ["Escote", labelFor(ESCOTES, dress.escote)],
                ["Espalda", labelFor(ESPALDAS, dress.espalda)],
                ["Mangas", labelFor(MANGAS, dress.manga)],
                ["Tela principal", labelFor(TELAS, dress.tela_principal)],
                ["Color", labelFor(COLORES, dress.color_principal)],
                ["Cola", labelFor(COLAS, dress.cola)],
                ["Condición", labelFor(CONDICIONES, dress.condicion)],
                ["Busto / cintura / cadera",
                  [dress.busto_cm, dress.cintura_cm, dress.cadera_cm].some(Boolean)
                    ? `${dress.busto_cm ?? "No especificado"} / ${dress.cintura_cm ?? "No especificado"} / ${dress.cadera_cm ?? "No especificado"} cm`
                    : "No especificado"],
                ["Altura de la persona que lo usó", dress.altura_persona_cm ? `${dress.altura_persona_cm} cm` : "No especificado"],
                ["¿Tuvo ajustes?", dress.tuvo_ajustes ? (dress.ajustes_detalle || "Sí, ver descripción") : "No"],
                ["Envío", dress.envio_nacional ? "Envío nacional disponible" : "Envío no disponible"],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "9px 0", color: "var(--color-text-muted)", width: "45%" }}>{label}</td>
                  <td style={{ padding: "9px 0", fontWeight: 500, textAlign: "right" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {characteristics.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Características</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {characteristics.map((c: any) => (
                  <span key={c.id} style={{ fontSize: 11.5, background: "var(--color-background-secondary)", padding: "4px 9px", borderRadius: 2 }}>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(dress.tiene_manchas || dress.tiene_jalones || dress.tiene_roturas || dress.dano_dobladillo || dress.falta_aplicaciones || dress.tiene_decoloracion) && (
            <div className="alert-error" style={{ marginBottom: 20 }}>
              <strong>Imperfecciones declaradas:</strong>{" "}
              {[
                dress.tiene_manchas && "manchas",
                dress.tiene_jalones && "jalones",
                dress.tiene_roturas && "roturas",
                dress.dano_dobladillo && "daño en el dobladillo",
                dress.falta_aplicaciones && "faltan aplicaciones",
                dress.tiene_decoloracion && "decoloración",
              ].filter(Boolean).join(", ")}
              {dress.descripcion_danos && <p style={{ marginTop: 6 }}>{dress.descripcion_danos}</p>}
            </div>
          )}

          {dress.descripcion && (
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{dress.descripcion}</p>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {user?.id === dress.seller_id ? <Link className="btn btn-primary" href={`/publicar/${dress.id}`}>Editar mi publicación</Link> : <><ContactSellerButton dressId={dress.id} sellerId={dress.seller_id} userId={user?.id} /><OfferButton dressId={dress.id} sellerId={dress.seller_id} userId={user?.id} price={dress.precio_venta_mxn} status={dress.status} /><FavoriteButton dressId={dress.id} /></>}
          </div>
          

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--color-border)", fontSize: 13 }}>
            {seller?.id ? (
              <Link href={`/vendedoras/${seller.id}`} style={{ fontWeight: 600 }}>
                {seller.display_name || "Perfil de vendedora"}
              </Link>
            ) : (
              <strong>Vendedora</strong>
            )}
            <div style={{ color: "var(--color-text-muted)" }}>{seller?.identity_verified ? "Identidad verificada" : "Identidad pendiente"}</div>
          </div>
        </div>
      </div>

      {similaresFirmados.length > 0 && (
        <section style={{ marginTop: 60 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Vestidos similares</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
            {(similaresFirmados as unknown as CatalogDress[]).map((d) => (
              <DressCard key={d.id} dress={d} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
