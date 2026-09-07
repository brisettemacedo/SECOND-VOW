"use client";

import { useEffect, useRef, useState } from "react";
import DressCard, { type CatalogDress } from "@/components/DressCard";

type Props = {
  initialDresses: CatalogDress[];
  total: number;
  filters: Record<string, string>;
};

export default function InfiniteDressGrid({ initialDresses, total, filters }: Props) {
  const [dresses, setDresses] = useState(initialDresses);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = dresses.length < total;

  useEffect(() => {
    setDresses(initialDresses);
    setPage(1);
    setFailed(false);
  }, [initialDresses]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || failed) return;

    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setLoading(true);
      try {
        const nextPage = page + 1;
        const params = new URLSearchParams(filters);
        params.set("page", String(nextPage));
        const response = await fetch(`/api/catalog?${params.toString()}`);
        if (!response.ok) throw new Error("No se pudo cargar la siguiente página");
        const payload = await response.json();
        setDresses((current) => [...current, ...(payload.dresses ?? [])]);
        setPage(nextPage);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "500px 0px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [failed, filters, hasMore, loading, page]);

  return <>
    <div className="catalog-grid">{dresses.map((dress) => <DressCard key={dress.id} dress={dress} />)}</div>
    <div className="catalog-infinite-status" ref={sentinel} aria-live="polite">
      {loading ? "Cargando más vestidos…" : null}
      {failed ? <button className="btn btn-secondary" type="button" onClick={() => setFailed(false)}>Intentar nuevamente</button> : null}
      {!hasMore ? "Ya viste todos los vestidos disponibles." : null}
    </div>
  </>;
}
