"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteDraftButton({ dressId }: { dressId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function removeDress() {
    if (!window.confirm("¿Eliminar esta publicación? Dejará de verse en tu cuenta y en el catálogo. Las ofertas pendientes se cancelarán. No podrás eliminarla si ya aceptaste una oferta.")) return;

    setDeleting(true);
    setError("");
    try {
      const { error: deleteError } = await createClient().rpc("remove_own_dress_listing", { p_dress_id: dressId });
      if (deleteError) throw deleteError;

      router.refresh();
    } catch (e: any) {
      setError(e?.message || "No fue posible eliminar la publicación.");
      setDeleting(false);
    }
  }

  return (
    <div className="delete-draft-wrap">
      <button type="button" className="btn btn-danger-outline" onClick={removeDress} disabled={deleting}>
        {deleting ? "Eliminando..." : "Eliminar publicación"}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
