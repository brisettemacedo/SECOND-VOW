// Espejo exacto de los valores permitidos en supabase/migrations/0002_fase3_catalogo.sql
// Si agregas una opción aquí, agrégala también al CHECK constraint correspondiente
// (y viceversa) | deben coincidir siempre.

export type CatalogOption = { value: string; label: string };


export const TALLAS_VESTIDO: CatalogOption[] = [
  { value: "0", label: "0" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "12", label: "12" },
  { value: "14", label: "14" },
  { value: "16", label: "16" },
  { value: "18", label: "18" },
  { value: "20", label: "20" },
  { value: "22", label: "22" },
  { value: "24", label: "24" },
  { value: "26", label: "26" },
  { value: "28", label: "28" },
  { value: "30", label: "30" },
  { value: "32", label: "32" },
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
];

export const SILUETAS: CatalogOption[] = [
  { value: "linea-a", label: "Línea A" },
  { value: "sirena", label: "Sirena" },
  { value: "fit-and-flare", label: "Fit and flare" },
  { value: "princesa", label: "Princesa" },
  { value: "ball-gown", label: "Ball gown" },
  { value: "recto-columna", label: "Recto o columna" },
  { value: "imperio", label: "Imperio" },
  { value: "evase", label: "Evasé" },
  { value: "mini", label: "Mini" },
  { value: "midi", label: "Midi" },
  { value: "jumpsuit", label: "Jumpsuit" },
  { value: "separados", label: "Separados" },
  { value: "otro", label: "Otro" },
];

export const ESCOTES: CatalogOption[] = [
  { value: "strapless-recto", label: "Strapless recto" },
  { value: "corazon", label: "Corazón" },
  { value: "v", label: "En V" },
  { value: "cuadrado", label: "Cuadrado" },
  { value: "halter", label: "Halter" },
  { value: "barco", label: "Barco" },
  { value: "cuello-alto", label: "Cuello alto" },
  { value: "ilusion", label: "Ilusión" },
  { value: "asimetrico", label: "Asimétrico" },
  { value: "off-shoulder", label: "Off shoulder" },
  { value: "redondo", label: "Redondo" },
  { value: "otro", label: "Otro" },
];

export const ESPALDAS: CatalogOption[] = [
  { value: "abierta", label: "Abierta" },
  { value: "baja", label: "Baja" },
  { value: "cerrada", label: "Cerrada" },
  { value: "corse", label: "Corsé" },
  { value: "botones", label: "Con botones" },
  { value: "cierre", label: "Con cierre" },
  { value: "ilusion", label: "Transparente o ilusión" },
  { value: "v", label: "En V" },
  { value: "otro", label: "Otro" },
];

export const MANGAS: CatalogOption[] = [
  { value: "sin-mangas", label: "Sin mangas" },
  { value: "tirantes-finos", label: "Tirantes finos" },
  { value: "tirantes-anchos", label: "Tirantes anchos" },
  { value: "corta", label: "Manga corta" },
  { value: "tres-cuartos", label: "Manga tres cuartos" },
  { value: "larga", label: "Manga larga" },
  { value: "removible", label: "Manga removible" },
  { value: "abullonada", label: "Manga abullonada" },
  { value: "off-shoulder", label: "Off shoulder" },
  { value: "capa", label: "Capa" },
  { value: "otro", label: "Otro" },
];

export const TELAS: CatalogOption[] = [
  { value: "mikado", label: "Mikado" },
  { value: "saten", label: "Satén" },
  { value: "crepe", label: "Crepé" },
  { value: "tul", label: "Tul" },
  { value: "encaje", label: "Encaje" },
  { value: "organza", label: "Organza" },
  { value: "chifon", label: "Chifón" },
  { value: "gasa", label: "Gasa" },
  { value: "tafeta", label: "Tafeta" },
  { value: "charmeuse", label: "Charmeuse" },
  { value: "seda", label: "Seda" },
  { value: "georgette", label: "Georgette" },
  { value: "otro", label: "Otro" },
];

export const COLORES: CatalogOption[] = [
  { value: "blanco", label: "Blanco" },
  { value: "blanco-natural", label: "Blanco natural" },
  { value: "ivory", label: "Ivory o marfil" },
  { value: "off-white", label: "Off-white" },
  { value: "champagne", label: "Champagne" },
  { value: "nude", label: "Nude" },
  { value: "blush", label: "Blush" },
  { value: "perla", label: "Perla" },
  { value: "plata", label: "Plata" },
  { value: "otro", label: "Otro" },
];

export const COLAS: CatalogOption[] = [
  { value: "sin-cola", label: "Sin cola" },
  { value: "barrido", label: "Barrido" },
  { value: "capilla", label: "Capilla" },
  { value: "catedral", label: "Catedral" },
  { value: "real", label: "Real" },
  { value: "desmontable", label: "Desmontable" },
];

export const CONDICIONES: CatalogOption[] = [
  { value: "nuevo-con-etiquetas", label: "Nuevo con etiquetas" },
  { value: "nuevo-sin-etiquetas", label: "Nuevo sin etiquetas" },
  { value: "nunca-usado", label: "Nunca usado" },
  { value: "usado-una-vez", label: "Usado una vez" },
  { value: "usado-sesion-fotografica", label: "Usado en sesión fotográfica" },
  { value: "muestra", label: "Vestido de muestra" },
  { value: "limpieza-profesional", label: "Limpieza profesional realizada" },
  { value: "requiere-limpieza", label: "Requiere limpieza" },
];

// Etiquetas legibles para mostrar el estado de moderación de una publicación
export const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending_review: "Pendiente de revisión",
  changes_requested: "Requiere cambios",
  approved: "Publicado",
  rejected: "Rechazado",
  archived: "Archivado",
  reserved: "Reservado",
  sold: "Vendido",
};
