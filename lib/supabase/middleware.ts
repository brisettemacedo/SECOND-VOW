import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Refresca el token de sesión en cada petición (Next.js Server Components
 * no pueden escribir cookies directamente, por eso esto vive en middleware).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, key } = getSupabasePublicEnv();

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Importante: no borrar esta línea. Refresca la sesión del usuario.
  await supabase.auth.getUser();

  return response;
}
