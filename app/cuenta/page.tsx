import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountForm from "@/components/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  return <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 24px" }}>
    <h1 style={{ fontSize: 26, marginBottom: 24 }}>Mi cuenta</h1>
    <AccountForm email={user.email ?? ""} initialFullName={profile?.full_name ?? ""} />
    <div className="actions" style={{ marginTop: 20 }}>
      <a className="btn btn-secondary" href="/mis-vestidos">Mis vestidos</a>
      <a className="btn btn-secondary" href="/favoritos">Vestidos guardados</a>
      <a className="btn btn-secondary" href="/verificar-identidad">Obtén “Identidad verificada”</a>
      <a className="btn btn-secondary" href="/cuenta/pagos">Pagos y retiros</a>
    </div>
  <p style={{marginTop:24}}><a href="/cuenta/privacidad">Privacidad y derechos ARCO</a></p></main>;
}
