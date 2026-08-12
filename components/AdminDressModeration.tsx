"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminDressModeration({ dressId }: { dressId: string }) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function moderate(action: "approved" | "changes_requested" | "rejected") {
    const reason = comments.trim();
    if ((action === "changes_requested" || action === "rejected") && !reason) {
      setError("Escribe el motivo antes de solicitar cambios o rechazar la publicación.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("admin_moderate_dress", {
        p_dress_id: dressId,
        p_action: action,
        p_comments: reason || null,
      });
      if (rpcError) throw rpcError;
      router.push("/admin/publicaciones");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "No fue posible guardar la decisión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-moderation-box">
      <h2>Decisión administrativa</h2>
      <div className="field">
        <label htmlFor="moderation-comments">
          Comentarios {" "}
          <span className="muted">(obligatorios para solicitar cambios o rechazar)</span>
        </label>
        <textarea
          id="moderation-comments"
          rows={5}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Explica con precisión qué debe corregirse o el motivo de la decisión."
        />
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="actions admin-moderation-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => moderate("approved")}>Aprobar y publicar</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => moderate("changes_requested")}>Solicitar cambios</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => moderate("rejected")}>Rechazar</button>
      </div>
    </section>
  );
}
