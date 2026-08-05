"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const next = searchParams.get("next") || "/";
  const pendingDressId = searchParams.get("dress");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      // Mensaje genérico a propósito: no revelar si el correo existe o no.
      setError("Correo o contraseña incorrectos.");
      return;
    }

    // Completa la acción que la usuaria intentaba hacer antes del login
    // (sección 10: "conservar la acción que la usuaria intentaba realizar").
    if (pendingDressId && data.user) {
      await supabase
        .from("favorites")
        .upsert({ user_id: data.user.id, dress_id: pendingDressId }, { onConflict: "user_id,dress_id" });
    }

    setLoading(false);
    router.push(next);
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, marginBottom: 24 }}>
        Inicia sesión
      </h1>

      {error && <div className="alert-error">{error}</div>}
      {pendingDressId && (
        <div className="alert-success">Inicia sesión para guardar este vestido en tus favoritos.</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>
      </form>

      <p style={{ marginTop: 14, fontSize: 13.5 }}>
        <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
      <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--color-text-muted)" }}>
        ¿No tienes cuenta?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}${pendingDressId ? `&dress=${pendingDressId}` : ""}`}>
          Crea una aquí
        </Link>.
      </p>
    </main>
  );
}
