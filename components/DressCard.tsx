import Link from "next/link";
import { dressImageUrl } from "@/lib/storage";
import { SILUETAS, CONDICIONES } from "@/lib/catalogs";
import FavoriteButton from "@/components/FavoriteButton";

type DressPhoto = { storage_path: string; signed_url?: string | null; is_primary: boolean; position: number };

export type CatalogDress = {
  id: string;
  model: string | null;
  talla_etiqueta: string;
  silueta: string;
  condicion: string;
  precio_original_mxn: number | null;
  precio_venta_mxn: number;
  envio_nacional: boolean;
  brands: { name: string } | { name: string }[] | null;
  brand_suggestions?: { suggested_name: string } | { suggested_name: string }[] | null;
  dress_photos: DressPhoto[];
};

function labelFor(list: { value: string; label: string }[], value: string) {
  return list.find((o) => o.value === value)?.label ?? value;
}

function brandName(brands: CatalogDress["brands"], suggestions?: CatalogDress["brand_suggestions"]) {
  const suggested = Array.isArray(suggestions) ? suggestions[0]?.suggested_name : suggestions?.suggested_name;
  if (!brands && suggested) return `${suggested} (marca en confirmación)`;
  if (!brands) return "Marca no especificada";
  if (Array.isArray(brands)) return brands[0]?.name ?? "Marca no especificada";
  return brands.name;
}

function primaryPhoto(photos: DressPhoto[]) {
  const sorted = [...photos].sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return a.position - b.position;
  });
  return sorted[0] ?? null;
}

function fmtPrice(v: number) {
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

export default function DressCard({ dress }: { dress: CatalogDress }) {
  const photo = primaryPhoto(dress.dress_photos ?? []);
  const discount =
    dress.precio_original_mxn && dress.precio_original_mxn > dress.precio_venta_mxn
      ? Math.round((1 - dress.precio_venta_mxn / dress.precio_original_mxn) * 100)
      : null;

  return (
    <Link
      href={`/vestidos/${dress.id}`}
      style={{
        display: "block",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        overflow: "hidden",
        background: "var(--color-surface)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ aspectRatio: "3 / 4", background: "var(--color-background-secondary)", position: "relative" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dressImageUrl(photo.storage_path, photo.signed_url)}
            alt={`${brandName(dress.brands, dress.brand_suggestions)}${dress.model ? " " + dress.model : ""}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 12.5 }}>
            Sin fotografía
          </div>
        )}
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <FavoriteButton dressId={dress.id} />
        </div>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-action-primary)" }}>
          {brandName(dress.brands, dress.brand_suggestions)}
        </div>
        <h3 style={{ fontSize: 16, margin: "4px 0 8px" }}>
          {labelFor(SILUETAS, dress.silueta)}
        </h3>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Talla {dress.talla_etiqueta}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginBottom: 8 }}>
          {labelFor(CONDICIONES, dress.condicion)}
          {dress.envio_nacional ? " | Envío nacional" : ""}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            {dress.precio_original_mxn && (
              <span style={{ fontSize: 11.5, color: "var(--color-text-muted)", textDecoration: "line-through", marginRight: 6 }}>
                {fmtPrice(dress.precio_original_mxn)}
              </span>
            )}
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 600 }}>
              {fmtPrice(dress.precio_venta_mxn)}
            </span>
          </div>
          {discount !== null && (
            <span style={{ fontSize: 10.5, background: "var(--color-success-bg)", color: "var(--color-success)", padding: "3px 7px", borderRadius: 2 }}>
              -{discount}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
