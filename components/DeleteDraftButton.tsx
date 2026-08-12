"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteDraftButton({ dressId }: { dressId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function removeDraft() {
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;

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
      if (dress?.status !== "draft") throw new Error("Solo se pueden eliminar publicaciones en borrador.");

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
      setError(e?.message || "No fue posible eliminar el borrador.");
      setDeleting(false);
    }
  }

  return (
    <div className="delete-draft-wrap">
      <button type="button" className="btn btn-danger-outline" onClick={removeDraft} disabled={deleting}>
        {deleting ? "Eliminando..." : "Eliminar borrador"}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
