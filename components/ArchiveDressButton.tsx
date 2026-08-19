"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ArchiveDressButton({ dressId }: { dressId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function archive() {
    if (!window.confirm("¿Archivar esta publicación? Dejará de verse en el catálogo público. Podrás seguir viéndola desde aquí.")) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("dresses").update({ status: "archived" }).eq("id", dressId);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  return (
    <div className="delete-draft-wrap">
      <button type="button" className="btn btn-secondary" onClick={archive} disabled={busy}>
        {busy ? "Archivando..." : "Archivar"}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
