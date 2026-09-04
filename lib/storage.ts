export function dressImageUrl(storagePath: string, signedUrl?: string | null): string {
  if (signedUrl) return signedUrl;
  const safePath = storagePath.split("/").map(encodeURIComponent).join("/");
  // Compatibilidad para registros todavía no firmados. La ruta responde con
  // una redirección temporal a Supabase; ya no retransmite el archivo.
  return `/api/dress-images/${safePath}`;
}
