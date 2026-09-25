"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FavoriteButton({ dressId }: { dressId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState<string | null | undefined>(undefined); // undefined = aún no se sabe
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(user?.id ?? null);

      if (user) {
        const { data } = await supabase
          .from("favorites")
          .select("dress_id")
          .eq("user_id", user.id)
          .eq("dress_id", dressId)
          .maybeSingle();
        if (active) setIsFavorite(!!data);
      }
    }

    load();
    return () => { active = false; };
  }, [dressId, supabase]);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (userId === null) {
      // No autenticada: la mandamos a login/registro conservando a dónde
      // regresar y qué vestido quería guardar.
      const next = encodeURIComponent(pathname);
      router.push(`/login?next=${next}&dress=${dressId}`);
      return;
    }
    if (!userId) return; // todavía cargando

    setLoading(true);
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("user_id", userId).eq("dress_id", dressId);
      setIsFavorite(false);
    } else {
      await supabase.from("favorites").insert({ user_id: userId, dress_id: dressId });
      setIsFavorite(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || userId === undefined}
      className="favorite-button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
      title={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </button>
  );
}
