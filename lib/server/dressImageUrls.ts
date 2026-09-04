import "server-only";

import { createAdminClient } from "@/lib/server/adminSupabase";

export type SignableDressPhoto = {
  storage_path: string;
  signed_url?: string | null;
  [key: string]: unknown;
};

/**
 * Firma en una sola llamada las fotografías que una consulta ya autorizada
 * decidió mostrar. El navegador descarga después los bytes directamente de
 * Supabase Storage; Vercel sólo entrega el HTML con estas URLs temporales.
 */
export async function signDressPhotos<T extends SignableDressPhoto>(
  photos: T[],
  expiresIn = 60 * 60 * 6,
): Promise<Array<T & { signed_url: string | null }>> {
  if (!photos.length) return [];

  const paths = photos.map((photo) => photo.storage_path);
  const { data, error } = await createAdminClient()
    .storage
    .from("dress-images")
    .createSignedUrls(paths, expiresIn);

  if (error) {
    console.error("No fue posible firmar las fotografías del vestido:", error.message);
    return photos.map((photo) => ({ ...photo, signed_url: null }));
  }

  return photos.map((photo, index) => ({
    ...photo,
    signed_url: data?.[index]?.signedUrl ?? null,
  }));
}

export async function signDressCollections<T extends { dress_photos?: SignableDressPhoto[] | null }>(
  dresses: T[],
  expiresIn = 60 * 60 * 6,
): Promise<T[]> {
  const allPhotos = dresses.flatMap((dress) => dress.dress_photos ?? []);
  const signed = await signDressPhotos(allPhotos, expiresIn);
  let offset = 0;

  return dresses.map((dress) => {
    const length = dress.dress_photos?.length ?? 0;
    const dressPhotos = signed.slice(offset, offset + length);
    offset += length;
    return { ...dress, dress_photos: dressPhotos };
  });
}
