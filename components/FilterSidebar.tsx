"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  SILUETAS, ESCOTES, ESPALDAS, MANGAS, TELAS, COLORES, CONDICIONES, ESTADOS_MX,
} from "@/lib/catalogs";

function CheckboxGroup({
  title,
  paramKey,
  options,
  searchParams,
  onToggle,
}: {
  title: string;
  paramKey: string;
  options: { value: string; label: string }[];
  searchParams: URLSearchParams;
  onToggle: (key: string, value: string) => void;
}) {
  const active = new Set((searchParams.get(paramKey) ?? "").split(",").filter(Boolean));

  return (
    <fieldset style={{ border: "none", padding: 0, marginBottom: 22 }}>
      <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</legend>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((opt) => (
          <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
            <input
              type="checkbox"
              checked={active.has(opt.value)}
              onChange={() => onToggle(paramKey, opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function FilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(next: URLSearchParams) {
    next.delete("page"); // cualquier cambio de filtro reinicia la paginación
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleMulti(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set((next.get(key) ?? "").split(",").filter(Boolean));
    if (current.has(value)) current.delete(value);
    else current.add(value);

    if (current.size === 0) next.delete(key);
    else next.set(key, Array.from(current).join(","));

    updateParams(next);
  }

  function setSingle(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    updateParams(next);
  }

  function clearAll() {
    router.push(pathname);
  }

  return (
    <aside className="catalog-sidebar" style={{ width: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>Filtrar</h2>
        <button
          onClick={clearAll}
          style={{ background: "none", border: "none", fontSize: 12.5, color: "var(--color-text-muted)", textDecoration: "underline", cursor: "pointer" }}
        >
          Limpiar
        </button>
      </div>

      <div className="field">
        <label>Ciudad</label>
        <input
          type="text"
          defaultValue={searchParams.get("ciudad") ?? ""}
          onBlur={(e) => setSingle("ciudad", e.target.value)}
          placeholder="Ej. Guadalajara"
        />
      </div>

      <div className="field">
        <label>Estado</label>
        <select
          defaultValue={searchParams.get("estado") ?? ""}
          onChange={(e) => setSingle("estado", e.target.value)}
        >
          <option value="">Todos</option>
          {ESTADOS_MX.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Precio máximo (MXN)</label>
        <input
          type="number"
          defaultValue={searchParams.get("precio_max") ?? ""}
          onBlur={(e) => setSingle("precio_max", e.target.value)}
          placeholder="Ej. 30000"
        />
      </div>

      <CheckboxGroup title="Silueta" paramKey="silueta" options={SILUETAS} searchParams={searchParams} onToggle={toggleMulti} />
      <CheckboxGroup title="Escote" paramKey="escote" options={ESCOTES} searchParams={searchParams} onToggle={toggleMulti} />
      <CheckboxGroup title="Espalda" paramKey="espalda" options={ESPALDAS} searchParams={searchParams} onToggle={toggleMulti} />
      <CheckboxGroup title="Mangas" paramKey="manga" options={MANGAS} searchParams={searchParams} onToggle={toggleMulti} />
      <CheckboxGroup title="Tela" paramKey="tela" options={TELAS} searchParams={searchParams} onToggle={toggleMulti} />
      <CheckboxGroup title="Color" paramKey="color" options={COLORES} searchParams={searchParams} onToggle={toggleMulti} />
      <CheckboxGroup title="Condición" paramKey="condicion" options={CONDICIONES} searchParams={searchParams} onToggle={toggleMulti} />
    </aside>
  );
}
