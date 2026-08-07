"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { DressCatalogData } from "@/lib/dressCatalogData";

type BrandOption = { id: string; name: string };

function CheckboxGroup({
  title,
  paramKey,
  options,
  draftParams,
  onToggle,
}: {
  title: string;
  paramKey: string;
  options: { value: string; label: string }[];
  draftParams: URLSearchParams;
  onToggle: (key: string, value: string) => void;
}) {
  const active = new Set((draftParams.get(paramKey) ?? "").split(",").filter(Boolean));

  return (
    <fieldset className="filter-group">
      <legend>{title}</legend>
      <div className="filter-options">
        {options.map((opt) => (
          <label key={opt.value} className="filter-check">
            <input
              type="checkbox"
              checked={active.has(opt.value)}
              onChange={() => onToggle(paramKey, opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function FilterSidebar({ brands, catalogs }: { brands: BrandOption[]; catalogs: DressCatalogData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftParams, setDraftParams] = useState(() => new URLSearchParams(searchParams.toString()));

  useEffect(() => {
    if (!open) setDraftParams(new URLSearchParams(searchParams.toString()));
  }, [searchParams, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCount = useMemo(() => {
    const keys = ["brand", "talla", "precio_min", "precio_max", "silueta", "escote", "espalda", "manga", "tela", "color", "condicion"];
    return keys.reduce((total, key) => {
      const value = searchParams.get(key);
      if (!value) return total;
      return total + (value.includes(",") ? value.split(",").filter(Boolean).length : 1);
    }, 0);
  }, [searchParams]);

  function toggleMulti(key: string, value: string) {
    setDraftParams((currentParams) => {
      const next = new URLSearchParams(currentParams.toString());
      const current = new Set((next.get(key) ?? "").split(",").filter(Boolean));
      if (current.has(value)) current.delete(value);
      else current.add(value);

      if (current.size === 0) next.delete(key);
      else next.set(key, Array.from(current).join(","));
      next.delete("page");
      return next;
    });
  }

  function setSingle(key: string, value: string) {
    setDraftParams((currentParams) => {
      const next = new URLSearchParams(currentParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    });
  }

  function clearDraft() {
    setDraftParams(new URLSearchParams());
  }

  function clearAll() {
    setDraftParams(new URLSearchParams());
    router.push(pathname);
    setOpen(false);
  }

  function applyFilters() {
    const query = draftParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="catalog-filter-bar">
        <button type="button" className="btn btn-secondary filter-trigger" onClick={() => setOpen(true)}>
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        {activeCount > 0 && (
          <button type="button" className="filter-clear-link" onClick={clearAll}>
            Limpiar filtros
          </button>
        )}
      </div>

      {open && (
        <div className="filter-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="filter-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="filter-modal-header">
              <div>
                <p className="filter-kicker">Personaliza tu búsqueda</p>
                <h2 id="filter-modal-title">Filtrar vestidos</h2>
              </div>
              <button type="button" className="filter-close" aria-label="Cerrar filtros" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>

            <div className="filter-modal-body">
              <div className="filter-section-wide">
                <div className="field">
                  <label htmlFor="filter-brand">Marca</label>
                  <select
                    id="filter-brand"
                    value={draftParams.get("brand") ?? ""}
                    onChange={(event) => setSingle("brand", event.target.value)}
                  >
                    <option value="">Todas las marcas</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-price-grid">
                  <div className="field">
                    <label htmlFor="filter-price-min">Precio mínimo (MXN)</label>
                    <input
                      id="filter-price-min"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={draftParams.get("precio_min") ?? ""}
                      onChange={(event) => setSingle("precio_min", event.target.value)}
                      placeholder="Ej. 5,000"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="filter-price-max">Precio máximo (MXN)</label>
                    <input
                      id="filter-price-max"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={draftParams.get("precio_max") ?? ""}
                      onChange={(event) => setSingle("precio_max", event.target.value)}
                      placeholder="Ej. 30,000"
                    />
                  </div>
                </div>
              </div>

              <CheckboxGroup title="Talla" paramKey="talla" options={catalogs.sizes} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Silueta" paramKey="silueta" options={catalogs.silhouettes} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Escote" paramKey="escote" options={catalogs.necklines} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Espalda" paramKey="espalda" options={catalogs.backs} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Mangas" paramKey="manga" options={catalogs.sleeves} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Tela" paramKey="tela" options={catalogs.fabrics} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Color" paramKey="color" options={catalogs.colors} draftParams={draftParams} onToggle={toggleMulti} />
              <CheckboxGroup title="Condición" paramKey="condicion" options={catalogs.conditions} draftParams={draftParams} onToggle={toggleMulti} />
            </div>

            <footer className="filter-modal-footer">
              <button type="button" className="filter-clear-link" onClick={clearDraft}>Limpiar selección</button>
              <button type="button" className="btn btn-primary" onClick={applyFilters}>Ver resultados</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
