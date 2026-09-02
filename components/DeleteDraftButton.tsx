"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DELETABLE_STATUSES = ["draft", "pending_review", "changes_requested", "rejected", "approved"];

export default function DeleteDraftButton({ dressId, hasOrderHistory = false }: { dressId: string; hasOrderHistory?: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function removeDress() {
    if (hasOrderHistory) return;
    if (!window.confirm("¿Eliminar esta publicación? Esta acción no se puede deshacer.")) return;

    setDeleting(true);
    setError("");
    const supabase = createClient();

    try {
      const { data: dress, error: dressError } = await supabase
        .from("dresses")
        .select("id,status")
        .eq("id", dressId)
        .single();

      if (dressError) throw dressError;
      if (!DELETABLE_STATUSES.includes(dress?.status)) {
        throw new Error("Esta publicación ya no puede eliminarse (tiene una oferta aceptada o ya fue vendida).");
      }

      const { data: photos, error: photosError } = await supabase
        .from("dress_photos")
        .select("storage_path")
        .eq("dress_id", dressId);

      if (photosError) throw photosError;

      const paths = (photos ?? []).map((photo: any) => photo.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from("dress-images").remove(paths);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase.from("dresses").delete().eq("id", dressId);
      if (deleteError) throw deleteError;

      router.refresh();
    } catch (e: any) {
      setError(e?.message || "No fue posible eliminar la publicación.");
      setDeleting(false);
    }
  }

  async function removePreservingHistory() {
    if (!window.confirm("¿Eliminar esta publicación? Dejará de verse en tu cuenta y en el catálogo. El historial de pedidos se conservará por seguridad.")) return;
    setDeleting(true); setError("");
    const { error } = await createClient().rpc("remove_own_dress_listing", { p_dress_id: dressId });
    setDeleting(false); if (error) setError(error.message); else router.refresh();
  }

  if (hasOrderHistory) return <div className="delete-draft-wrap"><button type="button" className="btn btn-danger-outline" onClick={removePreservingHistory} disabled={deleting}>{deleting?"Eliminando…":"Eliminar publicación"}</button>{error&&<p className="field-error">{error}</p>}</div>;

  return (
    <div className="delete-draft-wrap">
      <button type="button" className="btn btn-danger-outline" onClick={removeDress} disabled={deleting}>
        {deleting ? "Eliminando..." : "Eliminar publicación"}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
