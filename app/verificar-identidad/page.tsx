import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function Verify() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: account }] = await Promise.all([
    supabase.from("profiles").select("identity_verified").eq("id", user.id).maybeSingle(),
    supabase.from("seller_payment_accounts").select("onboarding_status,payouts_enabled,verified_at").eq("user_id", user.id).maybeSingle(),
  ]);
  return <main className="page narrow">
    <section className="panel">
      <h1>Verificación de identidad</h1>
      {profile?.identity_verified ? <>
        <span className="badge">Identidad verificada</span>
        <p>Tu verificación se completó mediante el proveedor de pagos. SECOND VOW no conserva una copia de tu identificación oficial.</p>
      </> : <>
        <p>La verificación se realiza mediante Stripe al vincular la cuenta bancaria de la vendedora. Stripe recopila directamente la información necesaria; SECOND VOW recibe únicamente el resultado y referencias técnicas.</p>
        <p>Estado actual: <span className="badge">{account?.onboarding_status ?? "No iniciada"}</span></p>
        <Link className="btn btn-primary" href="/cuenta/pagos">Vincular cuenta y verificarme</Link>
      </>}
    </section>
  </main>;
}
