/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Los archivos ya se comprimen al subirlos y la ruta estable aplica caché.
    // Evita los 404 que producía el optimizador con las fotos protegidas.
    unoptimized: true,
    // Las rutas de fotos públicas son estables: una miniatura puede reutilizarse
    // durante el ciclo mensual en vez de volver a descargar el original desde
    // Supabase varias veces al día.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1600],
    imageSizes: [64, 96, 128, 256, 384],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        // Reemplaza con el hostname real de tu proyecto Supabase, ej: abcxyz.supabase.co
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    }];
  },
};

export default nextConfig;
