"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    // El link de recuperación ya deja una sesión temporal activa;
    // updateUser aquí establece la nueva contraseña sobre esa sesión.
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("No se pudo actualizar la contraseña. Solicita un nuevo link de recuperación.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, marginBottom: 24 }}>
        Establece tu nueva contraseña
      </h1>

      {done ? (
        <div className="alert-success">Contraseña actualizada. Redirigiendo...</div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="password">Nueva contraseña</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </form>
      )}
    </main>
  );
}
