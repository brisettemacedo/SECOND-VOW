import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main>
      {/* HERO con foto principal */}
      <section
        style={{
          position: "relative",
          width: "100%",
          height: "70vh",
          minHeight: 420,
          overflow: "hidden",
        }}
      >
        <Image
          src="/images/hero-1.jpg"
          alt="Novia probándose un vestido de novia SecondVow"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 20%" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(27,42,30,0.15) 0%, rgba(27,42,30,0.55) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 40,
              color: "var(--color-text-inverse)",
              marginBottom: 8,
              letterSpacing: 1,
            }}
          >
            SecondVow
          </h1>
          <p
            style={{
              color: "var(--color-text-inverse)",
              opacity: 0.9,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            Encuentra vestidos por talla, medidas, marca y características.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 64px" }}>
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
      </div>

      {/* GALERÍA con las otras dos fotos */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 2,
        }}
      >
        <div style={{ position: "relative", aspectRatio: "3 / 4" }}>
          <Image
            src="/images/hero-2.jpg"
            alt="Detalle de encaje de vestido de novia"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div style={{ position: "relative", aspectRatio: "3 / 4" }}>
          <Image
            src="/images/hero-3.jpg"
            alt="Novia de espaldas con vestido de cola larga"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
        </div>
      </section>
    </main>
  );
}
