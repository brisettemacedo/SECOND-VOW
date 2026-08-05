import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Client Components ("use client").
 * Usa la llave pública (anon key) — es segura de exponer en el navegador
 * porque toda la protección real vive en las políticas RLS de la base de datos.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
