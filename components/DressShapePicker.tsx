"use client";

type ShapeKind = "silueta" | "escote" | "espalda";
type Props = { name: ShapeKind; label: string; options: { value: string; label: string }[]; value: string; error?: string; onChange: (value: string) => void };

const silhouettes: Record<string, string> = {
  "linea-a": "M40 18C33 12 30 17 34 26C36 33 39 41 39 48C35 68 28 89 22 112Q50 117 78 112C72 89 65 68 61 48C61 41 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z",
  "ball-gown": "M40 18C33 12 30 17 34 26C37 34 39 42 39 48C19 60 17 83 16 112Q50 117 84 112C83 83 81 60 61 48C61 42 63 34 66 26C70 17 67 12 60 18Q50 27 40 18Z",
  "recto-columna": "M40 18C33 12 30 17 34 26C36 33 39 42 39 48C33 62 36 83 36 113Q50 116 64 113C64 83 67 62 61 48C61 42 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z",
  "fit-and-flare": "M40 18C33 12 30 17 34 26C36 33 39 42 39 48C33 58 35 66 34 72C31 85 21 102 18 113Q50 118 82 113C79 102 69 85 66 72C65 66 67 58 61 48C61 42 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z",
  "trompeta": "M40 18C33 12 30 17 34 26C36 33 39 42 39 48C34 58 37 71 37 81C34 94 27 104 23 113Q50 117 77 113C73 104 66 94 63 81C63 71 66 58 61 48C61 42 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z",
  "sirena": "M40 18C33 12 30 17 34 26C36 33 39 42 39 48C32 61 39 77 41 96C35 103 29 109 26 113Q50 117 74 113C71 109 65 103 59 96C61 77 68 61 61 48C61 42 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z",
  "separados": "M40 18C33 12 30 17 34 26C36 33 39 39 39 44Q50 47 61 44C61 39 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z M39 53Q50 55 61 53L65 113Q50 116 35 113Z",
  "jumpsuit": "M40 18C33 12 30 17 34 26C36 33 39 42 39 48C33 60 37 82 31 113H46L50 67L54 113H69C63 82 67 60 61 48C61 42 64 33 66 26C70 17 67 12 60 18Q50 27 40 18Z"
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
  return <svg viewBox="0 0 100 125" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    {!path ? <text x="50" y="77" textAnchor="middle" fill="currentColor" stroke="none" fontSize="38">?</text> : <>
      {kind !== "silueta" && <path d="M30 22L17 30L23 48L29 43L37 91H63L71 43L77 48L83 30L70 22" opacity=".35" />}
      <path d={path} />
      {value === "ilusion" && <path d="M35 36L63 55 M34 47L60 65 M42 32L68 50" strokeDasharray="2 4" opacity=".45" />}
    </>}
  </svg>;
}
export default function DressShapePicker({ name, label, options, value, error, onChange }: Props) {
  const selected = options.find((option) => option.value === value);
  return <fieldset className={`shape-picker shape-picker-${name} ${error ? "field-invalid" : ""}`} aria-describedby={error ? `${name}-error` : undefined}>
    <legend>{label}<span className="required-mark"> *</span></legend>
    <details open={name === "silueta" ? true : undefined}>
      <summary>{selected ? selected.label : "Selecciona una forma"}<span>Ver ilustraciones y elegir</span></summary>
      <p className="muted shape-reference">Delineados de referencia para ayudarte a identificar la forma.</p>
      <div className="shape-options">{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? "shape-selected" : ""} onClick={() => onChange(option.value)}>
        <Outline kind={name} value={option.value} /><span>{option.label}</span>{value === option.value && <span className="shape-check" aria-hidden="true">✓</span>}
      </button>)}</div>
    </details>
    {error && <p id={`${name}-error`} className="field-error">{error}</p>}
  </fieldset>;
}
