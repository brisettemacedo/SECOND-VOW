import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isAdmin = data?.role === "admin";
  }
  return (
    <header className="site-header">
      <Link href="/" className="brand">SECOND VOW</Link>
      <nav>
        <Link href="/vestidos">Vestidos</Link>
        {user && <Link href="/publicar">Vender</Link>}
        {user && <Link href="/favoritos">Guardados</Link>}
        {user && <Link href="/mensajes">Mensajes</Link>}
        {user && <Link href="/ofertas">Ofertas</Link>}
        {user && <Link href="/pedidos">Pedidos</Link>}
        {user && <Link href="/cuenta">Cuenta</Link>}
        {isAdmin && <Link href="/admin">Administración</Link>}
        {!user ? <Link href="/login">Ingresar</Link> : <form action="/auth/signout" method="post"><button type="submit" className="link-button">Salir</button></form>}
      </nav>
    </header>
  );
}
