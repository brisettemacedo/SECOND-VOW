export const DRESS_REQUIRED_FIELDS = [
  ["brand", "Marca"], ["talla_etiqueta", "talla"], ["silueta", "silueta"], ["escote", "escote"], ["espalda", "espalda"],
  ["manga", "manga"], ["condicion", "condición"], ["precio_venta_mxn", "precio"],
] as const;

export function missingDressRequirements(dress: any) {
  const missing: string[] = DRESS_REQUIRED_FIELDS.filter(([key]) => key === "brand"
    ? !dress.brand_id && !dress.brand_suggestion_id
    : dress[key] === null || dress[key] === undefined || String(dress[key]).trim() === "").map(([, label]) => label);
  if (!(dress.dress_photos?.length > 0)) missing.push("una fotografía");
  return missing;
}
