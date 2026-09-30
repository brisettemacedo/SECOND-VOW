"use client";

type ShapeKind = "silueta" | "escote" | "espalda";
type Props = { name: ShapeKind; label: string; options: { value: string; label: string }[]; value: string; error?: string; onChange: (value: string) => void };

const silhouettes: Record<string, string> = {
  "linea-a": "M37 18L43 28H57L63 18L69 26L60 53L79 112H21L40 53L31 26Z",
  "sirena": "M37 18L43 28H57L63 18L68 27L60 52Q69 71 57 88L78 112H22L43 88Q31 71 40 52L32 27Z",
  "fit-and-flare": "M37 18L43 28H57L63 18L68 27L60 52L64 72L80 112H20L36 72L40 52L32 27Z",
  "princesa": "M37 18L43 28H57L63 18L68 27L60 50Q77 65 88 112H12Q23 65 40 50L32 27Z M40 50H60",
  "ball-gown": "M37 18L43 28H57L63 18L68 27L60 50Q86 66 92 112H8Q14 66 40 50L32 27Z M40 50H60",
  "recto-columna": "M37 18L43 28H57L63 18L68 27L60 51L63 112H37L40 51L32 27Z",
  "imperio": "M37 18L43 28H57L63 18L68 27L62 39L78 112H22L38 39L32 27Z M38 39H62",
  "evase": "M37 18L43 28H57L63 18L68 27L60 50L72 112H28L40 50L32 27Z",
  "mini": "M37 18L43 28H57L63 18L68 27L60 51L70 77H30L40 51L32 27Z",
  "midi": "M37 18L43 28H57L63 18L68 27L60 51L74 96H26L40 51L32 27Z",
  "jumpsuit": "M37 18L43 28H57L63 18L68 27L60 51L65 112H52L50 67L48 112H35L40 51L32 27Z",
  "separados": "M37 18L43 28H57L63 18L68 27L60 47H40L32 27Z M40 55H60L79 112H21Z"
};
const necklines: Record<string, string> = {
  "strapless-recto": "M25 44H75",
  "corazon": "M25 44Q36 28 50 44Q64 28 75 44",
  "v": "M30 22L50 64L70 22",
  "cuadrado": "M30 22V50H70V22",
  "halter": "M42 16H58L75 44 M42 16L25 44",
  "barco": "M22 28Q50 40 78 28",
  "cuello-alto": "M41 16H59V26H41Z M30 30L41 26 M59 26L70 30",
  "ilusion": "M30 22Q50 40 70 22 M25 51Q36 36 50 51Q64 36 75 51",
  "asimetrico": "M25 50L70 22",
  "off-shoulder": "M18 41Q50 57 82 41L78 53 M18 41L22 53",
  "redondo": "M30 22Q30 62 50 62Q70 62 70 22"
};
const backs: Record<string, string> = {
  "abierta": "M36 25Q50 15 64 25L67 61Q50 89 33 61Z",
  "baja": "M30 22Q30 88 50 88Q70 88 70 22",
  "cerrada": "M30 22Q50 37 70 22",
  "corse": "M40 30V87 M60 30V87 M40 35L60 45L40 55L60 65L40 75L60 85 M60 35L40 45L60 55L40 65L60 75L40 85",
  "botones": "M30 22Q50 37 70 22 M50 34V91 M48 40H52 M48 49H52 M48 58H52 M48 67H52 M48 76H52 M48 85H52",
  "cierre": "M30 22Q50 37 70 22 M48 34V90 M52 34V90 M48 42H52 M48 50H52 M48 58H52 M48 66H52 M48 74H52 M48 82H52",
  "ilusion": "M30 22Q50 37 70 22 M27 58Q50 73 73 58",
  "v": "M30 22L50 80L70 22"
};
function Outline({ kind, value }: { kind: ShapeKind; value: string }) {
  const path = (kind === "silueta" ? silhouettes : kind === "escote" ? necklines : backs)[value];
  return <svg viewBox="0 0 100 125" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {!path ? <text x="50" y="77" textAnchor="middle" fill="currentColor" stroke="none" fontSize="38">?</text> : <>
      {kind !== "silueta" && <path d="M30 22L17 30L23 48L29 43L37 91H63L71 43L77 48L83 30L70 22" opacity=".35" />}
      <path d={path} />
      {value === "ilusion" && <path d="M35 36L63 55 M34 47L60 65 M42 32L68 50" strokeDasharray="2 4" opacity=".45" />}
    </>}
  </svg>;
}
export default function DressShapePicker({ name, label, options, value, error, onChange }: Props) {
  const selected = options.find((option) => option.value === value);
  return <fieldset className={`shape-picker ${error ? "field-invalid" : ""}`} aria-describedby={error ? `${name}-error` : undefined}>
    <legend>{label}<span className="required-mark"> *</span></legend>
    <details>
      <summary>{selected ? selected.label : "Selecciona una forma"}<span>Ver ilustraciones y elegir</span></summary>
      <p className="muted shape-reference">Delineados de referencia para ayudarte a identificar la forma.</p>
      <div className="shape-options">{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? "shape-selected" : ""} onClick={() => onChange(option.value)}>
        <Outline kind={name} value={option.value} /><span>{option.label}</span>{value === option.value && <span className="shape-check" aria-hidden="true">✓</span>}
      </button>)}</div>
    </details>
    {error && <p id={`${name}-error`} className="field-error">{error}</p>}
  </fieldset>;
}
