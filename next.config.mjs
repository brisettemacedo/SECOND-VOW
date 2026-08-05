/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Reemplaza con el hostname real de tu proyecto Supabase, ej: abcxyz.supabase.co
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
