import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32, marginBottom: 8 }}>
        SecondVow
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 32 }}>
        Encuentra vestidos por talla, medidas, marca y características.
      </p>

      {user ? (
        <div className="alert-success">
          Sesión activa como <strong>{user.email}</strong>.
        </div>
      ) : (
        <div className="alert-error">No hay sesión activa.</div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/vestidos">
          Ver catálogo
        </Link>
        {!user && (
          <>
            <Link className="btn btn-secondary" href="/login">
              Iniciar sesión
            </Link>
            <Link className="btn btn-secondary" href="/signup">
              Crear cuenta
            </Link>
          </>
        )}
        {user && (
          <>
            <Link className="btn btn-secondary" href="/favoritos">
              Mis favoritos
            </Link>
            <Link className="btn btn-secondary" href="/cuenta">
              Mi cuenta
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
