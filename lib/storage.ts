/**
 * Convierte una ruta guardada en dress_photos.storage_path
 * (ej. "user-id/dress-id/photo-id.webp") en una URL pública servible.
 * Requiere que el bucket "dress-images" sea público (ver migración 0002).
 *
 * Es una función pura (solo arma un string) a propósito, para poder
 * usarla tanto en Server Components como en Client Components sin
 * necesidad de crear un cliente de Supabase completo solo para esto.
 */
export function dressImageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/dress-images/${storagePath}`;
}
