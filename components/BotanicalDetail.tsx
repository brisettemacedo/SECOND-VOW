import Image from "next/image";

// Display separate motifs from the supplied collage without redrawing the artwork.
const MOTIFS = {
  sage: { x: 0, y: 0, width: 388, height: 456 },
  blossom: { x: 382, y: 386, width: 315, height: 311 },
  petal: { x: 610, y: 0, width: 470, height: 565 },
  swallows: { x: 560, y: 786, width: 410, height: 180 },
  lace: { x: 10, y: 482, width: 316, height: 492 },
} as const;

export default function BotanicalDetail({ motif, className = "" }: {
  motif: keyof typeof MOTIFS;
  className?: string;
}) {
  const crop = MOTIFS[motif];
  return <span aria-hidden="true" className={`botanical-detail botanical-${motif} ${className}`} style={{ aspectRatio: `${crop.width} / ${crop.height}` }}>
    <Image src="/images/botanical-details.webp" alt="" width={1080} height={1080} sizes="400px" draggable={false}
      style={{ width: `${1080 / crop.width * 100}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />
  </span>;
}
