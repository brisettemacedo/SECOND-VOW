"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RecoverPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`,
    });

    // Siempre mostramos el mismo mensaje exista o no la cuenta,
    // para no revelar qué correos están registrados.
    setLoading(false);
    setSent(true);
  }

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, marginBottom: 24 }}>
        Recupera tu contraseña
      </h1>

      {sent ? (
        <div className="alert-success">
          Si ese correo tiene una cuenta con nosotros, te enviamos instrucciones para restablecer tu contraseña.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Enviando..." : "Enviar instrucciones"}
          </button>
        </form>
      )}
    </main>
  );
}
