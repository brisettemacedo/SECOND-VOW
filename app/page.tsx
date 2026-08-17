import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

// Evita que Next.js guarde esta página en caché estática,
// así cada visita puede mostrar una foto distinta del hero.
export const dynamic = "force-dynamic";

const HERO_IMAGES = [
  { src: "/images/hero-1.jpg", alt: "Novia probándose un vestido de novia SecondVow" },
  { src: "/images/hero-2.jpg", alt: "Detalle de encaje de vestido de novia" },
  { src: "/images/hero-3.jpg", alt: "Novia de espaldas con vestido de cola larga" },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const heroImage =
    HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];

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
          src={heroImage.src}
          alt={heroImage.alt}
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
            Encuentra vestidos por talla, estilo y marca.
            El marketplace número 1 de vestidos de novia.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link className="btn btn-primary" href="/vestidos">
              Ver catálogo
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES: Accesible / Confidencial / Seguro */}
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "48px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 32,
        }}
      >
        <div>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary, #4b5e42)"
            strokeWidth="1.6"
            style={{ marginBottom: 12 }}
          >
            <path d="M20.59 13.41 12 22l-9-9 8.59-8.59A2 2 0 0 1 13 4h6a1 1 0 0 1 1 1v6a2 2 0 0 1-.41 1.41Z" />
            <circle cx="16.5" cy="7.5" r="1.5" fill="var(--color-primary, #4b5e42)" stroke="none" />
          </svg>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 20,
              marginBottom: 8,
            }}
          >
            Accesible
          </h3>
          <p style={{ color: "var(--color-text-muted)" }}>
            Sin comisiones de consignación ni tarifas ocultas. Compras
            directo con la vendedora.
          </p>
        </div>
        <div>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary, #4b5e42)"
            strokeWidth="1.6"
            style={{ marginBottom: 12 }}
          >
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 20,
              marginBottom: 8,
            }}
          >
            Confidencial
          </h3>
          <p style={{ color: "var(--color-text-muted)" }}>
            Tu información nunca se comparte. Tú decides qué mostrar y con
            quién hablar.
          </p>
        </div>
        <div>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary, #4b5e42)"
            strokeWidth="1.6"
            style={{ marginBottom: 12 }}
          >
            <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 20,
              marginBottom: 8,
            }}
          >
            Seguro
          </h3>
          <p style={{ color: "var(--color-text-muted)" }}>
            Tu pago se libera hasta que confirmas que el vestido llegó como
            esperabas.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 64px" }}>
        {user ? (
          <div className="alert-success">
            Sesión activa como <strong>{user.email}</strong>.
          </div>
        ) : (
          <div className="alert-error">No hay sesión activa.</div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
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
    </main>
  );
}
