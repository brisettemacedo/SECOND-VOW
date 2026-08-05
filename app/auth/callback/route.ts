import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const pendingDressId = searchParams.get("dress");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Completa la acción pendiente (sección 10) también cuando la
      // usuaria confirma su cuenta por correo, no solo cuando inicia
      // sesión directamente.
      if (pendingDressId && data.user) {
        await supabase
          .from("favorites")
          .upsert({ user_id: data.user.id, dress_id: pendingDressId }, { onConflict: "user_id,dress_id" });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
