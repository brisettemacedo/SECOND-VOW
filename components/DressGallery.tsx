"use client";

import { useState } from "react";
import { dressImageUrl } from "@/lib/storage";

type Photo = { id: string; storage_path: string; classification?: string | null };

/* Las imágenes vienen de Supabase Storage con URL dinámica; no usan el optimizador de Next. */
/* eslint-disable @next/next/no-img-element */
export default function DressGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const active = photos[selected] ?? photos[0];
  return <div className="dress-gallery">
    <div className="dress-gallery-main">
      {active ? <img src={dressImageUrl(active.storage_path)} alt={active.classification || alt} /> : <div className="dress-gallery-empty">Sin fotografías</div>}
    </div>
    {photos.length > 1 && <div className="dress-gallery-thumbnails" aria-label="Fotografías del vestido">
      {photos.map((photo, index) => <button type="button" key={photo.id} className={index === selected ? "active" : ""} onClick={() => setSelected(index)} aria-label={`Ver fotografía ${index + 1}`} aria-pressed={index === selected}>
        <img src={dressImageUrl(photo.storage_path)} alt={photo.classification || `Fotografía ${index + 1}`} />
      </button>)}
    </div>}
  </div>;
}
