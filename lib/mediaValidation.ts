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
