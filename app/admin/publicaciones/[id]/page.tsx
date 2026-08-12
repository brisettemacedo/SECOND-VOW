import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { dressImageUrl } from "@/lib/storage";
import { SILUETAS, ESCOTES, ESPALDAS, MANGAS, TELAS, COLORES, COLAS, CONDICIONES } from "@/lib/catalogs";
import AdminDressModeration from "@/components/AdminDressModeration";

export const dynamic = "force-dynamic";

function labelFor(list: { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return "—";
  return list.find((item) => item.value === value)?.label ?? value;
}

function yesNo(v: any) { return v ? "Sí" : "No"; }

export default async function AdminPublicationDetail({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const id = params?.id;
  if (!id) notFound();

  // La ficha se carga en consultas separadas para que una relación opcional
  // no convierta toda la revisión administrativa en un 404.
  const { data: dress, error: dressError } = await supabase
    .from("dresses")
    .select("*,brands(name),brand_suggestions(suggested_name,status)")
    .eq("id", id)
    .maybeSingle();

  if (dressError || !dress) notFound();

  const [
    { data: seller },
    { data: photoRows },
    { data: characteristicRows },
    { data: declarationRows },
    { data: historyRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role,is_blocked,created_at").eq("id", dress.seller_id).maybeSingle(),
    supabase.from("dress_photos").select("id,storage_path,is_primary,position,classification,created_at").eq("dress_id", dress.id).order("position"),
    supabase.from("dress_characteristics").select("characteristic_id,characteristics(label)").eq("dress_id", dress.id),
    supabase.from("dress_declarations").select("authenticity_declared,photos_correspond_declared,right_to_sell_declared,information_true_declared,terms_version,declared_at").eq("dress_id", dress.id).order("declared_at", { ascending: false }).limit(1),
    supabase.from("dress_moderation_history").select("id,action,status_from,status_to,comments,admin_id,created_at").eq("dress_id", dress.id).order("created_at", { ascending: false }),
  ]);

  const photos = [...(photoRows ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.position - b.position);
  const brandRel = Array.isArray(dress.brands) ? dress.brands[0] : dress.brands;
  const suggestionRel = Array.isArray(dress.brand_suggestions) ? dress.brand_suggestions[0] : dress.brand_suggestions;
  const brand = brandRel?.name ?? suggestionRel?.suggested_name ?? "Marca pendiente";
  const cleanModel = (value: any) => {
    const text = String(value ?? "").trim();
    return /^(na|n\/a|no aplica|sin modelo)$/i.test(text) ? "" : text;
  };
  const model = cleanModel(dress.model);
  const chars = (characteristicRows ?? []).map((item: any) => {
    const relation = Array.isArray(item.characteristics) ? item.characteristics[0] : item.characteristics;
    return relation?.label;
  }).filter(Boolean);
  const declarations = declarationRows?.[0] ?? null;
  const history = historyRows ?? [];

  const rows: [string, any][] = [
    ["ID de publicación", dress.id],
    ["Vendedora", seller?.full_name || "Sin nombre visible"],
    ["ID de vendedora", dress.seller_id],
    ["Cuenta bloqueada", seller?.is_blocked ? "Sí" : "No"],
    ["Estado", dress.status],
    ["Enviado a revisión / última actualización", dress.updated_at ? new Date(dress.updated_at).toLocaleString("es-MX") : "—"],
    ["Creado", dress.created_at ? new Date(dress.created_at).toLocaleString("es-MX") : "—"],
    ["Marca", brand], ["Modelo", model || "—"], ["Colección", dress.collection || "—"], ["Año aproximado", dress.year_approx || "—"],
    ["Talla de etiqueta", dress.talla_etiqueta || "—"], ["Sistema de talla", dress.sistema_talla || "—"],
    ["Busto", dress.busto_cm ? `${dress.busto_cm} cm` : "—"], ["Cintura", dress.cintura_cm ? `${dress.cintura_cm} cm` : "—"], ["Cadera", dress.cadera_cm ? `${dress.cadera_cm} cm` : "—"],
    ["Hombro a piso", dress.largo_hombro_piso_cm ? `${dress.largo_hombro_piso_cm} cm` : "—"], ["Altura de quien lo usó", dress.altura_persona_cm ? `${dress.altura_persona_cm} cm` : "—"], ["Tacón", dress.altura_tacon_cm != null ? `${dress.altura_tacon_cm} cm` : "—"],
    ["Puede ampliarse", yesNo(dress.puede_ampliarse)], ["Puede reducirse", yesNo(dress.puede_reducirse)],
    ["Silueta", labelFor(SILUETAS, dress.silueta)], ["Escote", labelFor(ESCOTES, dress.escote)], ["Espalda", labelFor(ESPALDAS, dress.espalda)], ["Manga", labelFor(MANGAS, dress.manga)],
    ["Tela principal", labelFor(TELAS, dress.tela_principal)], ["Tela secundaria", labelFor(TELAS, dress.tela_secundaria)], ["Color principal", labelFor(COLORES, dress.color_principal)], ["Color de forro", dress.color_forro || "—"],
    ["Cola", labelFor(COLAS, dress.cola)], ["Largo de cola", dress.cola_largo_cm != null ? `${dress.cola_largo_cm} cm` : "—"],
    ["Condición", labelFor(CONDICIONES, dress.condicion)], ["Manchas", yesNo(dress.tiene_manchas)], ["Jalones", yesNo(dress.tiene_jalones)], ["Roturas", yesNo(dress.tiene_roturas)], ["Daño en dobladillo", yesNo(dress.dano_dobladillo)], ["Faltan aplicaciones", yesNo(dress.falta_aplicaciones)], ["Reparaciones", yesNo(dress.tiene_reparaciones)], ["Decoloración", yesNo(dress.tiene_decoloracion)], ["Descripción de daños", dress.descripcion_danos || "—"],
    ["Tuvo ajustes", yesNo(dress.tuvo_ajustes)], ["Detalle de ajustes", dress.ajustes_detalle || "—"], ["Conserva margen de costura", dress.conserva_margen_costura == null ? "—" : yesNo(dress.conserva_margen_costura)],
    ["Precio original", dress.precio_original_mxn ? `$${Number(dress.precio_original_mxn).toLocaleString("es-MX")} MXN` : "—"], ["Precio de venta", dress.precio_venta_mxn ? `$${Number(dress.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "—"],
    ["Envío nacional", yesNo(dress.envio_nacional)], ["Descripción adicional", dress.descripcion || "—"],
  ];

  return (
    <main className="page admin-publication-detail">
      <div className="title-row">
        <div><span className="badge">{dress.status === "pending_review" ? "En revisión" : dress.status}</span><h1>{brand}{model ? ` ${model}` : ""}</h1></div>
        <Link className="btn btn-secondary" href="/admin/publicaciones">Volver a publicaciones</Link>
      </div>

      <section className="panel">
        <h2>Fotografías ({photos.length})</h2>
        <div className="admin-photo-grid">
          {photos.map((photo: any) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dressImageUrl(photo.storage_path)} alt={photo.classification || "Fotografía del vestido"} />
              <figcaption>{photo.is_primary ? "Principal" : photo.classification || `Posición ${Number(photo.position ?? 0) + 1}`}</figcaption>
            </figure>
          ))}
          {!photos.length && <div className="alert-error">Esta solicitud no tiene fotografías disponibles para revisión.</div>}
        </div>
      </section>

      <section className="panel">
        <h2>Información completa de la solicitud</h2>
        <div className="admin-data-grid">
          {rows.map(([label, value]) => <div className="admin-data-item" key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}
        </div>
        {chars.length > 0 && <div className="admin-characteristics"><h3>Características y detalles</h3><div>{chars.map((c: string) => <span className="badge" key={c}>{c}</span>)}</div></div>}
      </section>

      <section className="panel">
        <h2>Declaraciones de la vendedora</h2>
        {declarations ? <ul className="admin-declarations">
          <li>{declarations.authenticity_declared ? "✓" : "✕"} Autenticidad declarada</li>
          <li>{declarations.photos_correspond_declared ? "✓" : "✕"} Fotografías corresponden al vestido</li>
          <li>{declarations.right_to_sell_declared ? "✓" : "✕"} Derecho para vender</li>
          <li>{declarations.information_true_declared ? "✓" : "✕"} Información verdadera y completa</li>
          <li>Versión de términos: {declarations.terms_version || "—"}</li>
          <li>Declarado: {declarations.declared_at ? new Date(declarations.declared_at).toLocaleString("es-MX") : "—"}</li>
        </ul> : <div className="alert-error">No hay declaraciones registradas para esta solicitud.</div>}
      </section>

      {history.length > 0 && <section className="panel"><h2>Historial de moderación</h2>{history.map((h: any) => <div className="moderation-history-item" key={h.id}><strong>{h.action}</strong><span>{new Date(h.created_at).toLocaleString("es-MX")}</span>{h.comments && <p>{h.comments}</p>}</div>)}</section>}

      {dress.status === "pending_review" ? <AdminDressModeration dressId={dress.id} /> : <div className="alert-success">Esta publicación ya fue resuelta. Estado actual: {dress.status}.</div>}
    </main>
  );
}
