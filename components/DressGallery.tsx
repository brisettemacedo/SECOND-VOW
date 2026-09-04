"use client";

import { useState } from "react";
import Image from "next/image";
import { dressImageUrl } from "@/lib/storage";

type Photo = { id: string; storage_path: string; signed_url?: string | null; classification?: string | null };

export default function DressGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const active = photos[selected] ?? photos[0];
  return <div className="dress-gallery">
    <div className="dress-gallery-main">
      {active ? <Image src={dressImageUrl(active.storage_path, active.signed_url)} alt={active.classification || alt} width={1200} height={1600} sizes="(max-width: 800px) 100vw, 60vw" /> : <div className="dress-gallery-empty">Sin fotografías</div>}
    </div>
    {photos.length > 1 && <div className="dress-gallery-thumbnails" aria-label="Fotografías del vestido">
      {photos.map((photo, index) => <button type="button" key={photo.id} className={index === selected ? "active" : ""} onClick={() => setSelected(index)} aria-label={`Ver fotografía ${index + 1}`} aria-pressed={index === selected}>
        <Image src={dressImageUrl(photo.storage_path, photo.signed_url)} alt={photo.classification || `Fotografía ${index + 1}`} width={120} height={160} sizes="120px" />
      </button>)}
    </div>}
  </div>;
}
