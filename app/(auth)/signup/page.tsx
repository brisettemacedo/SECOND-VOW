"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const next = searchParams.get("next") || "/";
  const pendingDressId = searchParams.get("dress");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);

    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    callbackUrl.searchParams.set("next", next);
    if (pendingDressId) callbackUrl.searchParams.set("dress", pendingDressId);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Este dato llega a la columna full_name de "profiles" a través
        // del trigger handle_new_user() definido en la migración SQL.
        data: { full_name: fullName },
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <main style={{ maxWidth: 400, margin: "0 auto", padding: "64px 24px" }}>
        <div className="alert-success">
          Te enviamos un correo de confirmación a <strong>{email}</strong>.
          Confirma tu cuenta para poder iniciar sesión.
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, marginBottom: 24 }}>
        Crea tu cuenta
      </h1>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Nombre</label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 13.5, color: "var(--color-text-muted)" }}>
        ¿Ya tienes cuenta? <Link href={`/login?next=${encodeURIComponent(next)}${pendingDressId ? `&dress=${pendingDressId}` : ""}`}>Inicia sesión</Link>.
      </p>
    </main>
  );
}
