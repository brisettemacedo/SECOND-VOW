export async function validateUploadMedia(file: File, options: { allowPdf?: boolean; maxVideoSeconds?: number } = {}) {
  if (file.type === "application/pdf" && options.allowPdf) return;
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error("No pudimos leer la imagen"));image.src=url});
      if (dimensions.width>8000||dimensions.height>8000||dimensions.width*dimensions.height>24_000_000) throw new Error("La imagen es demasiado grande. Usa máximo 24 megapíxeles y 8,000 px por lado.");
    } finally { URL.revokeObjectURL(url); }
    return;
  }
  if (file.type === "video/mp4") {
    const url=URL.createObjectURL(file);
    try {
      const duration=await new Promise<number>((resolve,reject)=>{const video=document.createElement("video");video.preload="metadata";video.onloadedmetadata=()=>resolve(video.duration);video.onerror=()=>reject(new Error("No pudimos leer el video"));video.src=url});
      if (!Number.isFinite(duration)||duration>(options.maxVideoSeconds??120)) throw new Error(`El video debe durar máximo ${options.maxVideoSeconds??120} segundos.`);
    } finally { URL.revokeObjectURL(url); }
    return;
  }
  throw new Error("Formato de archivo no permitido.");
}

const OPTIMIZED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Reduce las fotografías del catálogo antes de enviarlas a Storage.
 * 2,000 px conserva detalle suficiente para la ficha y evita almacenar y
 * descargar originales de cámara de varios megabytes. También elimina EXIF,
 * que puede contener ubicación y otros metadatos privados.
 */
export async function optimizeDressImage(file: File): Promise<File> {
  if (!OPTIMIZED_IMAGE_TYPES.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Algunos navegadores o formatos no admiten createImageBitmap. En ese
    // caso se conserva el original para no bloquear la publicación.
    return file;
  }
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "vestido";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
