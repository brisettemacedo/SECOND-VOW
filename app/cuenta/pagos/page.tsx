import { requireUser } from "@/lib/auth";
import PayoutsClient from "@/components/PayoutsClient";

export default async function PaymentsAccountPage() {
  const { supabase, user } = await requireUser();
  const [{ data: paymentAccount }, { data: orders }] = await Promise.all([
    supabase.from("seller_payment_accounts").select("provider,onboarding_status,charges_enabled,payouts_enabled,bank_account_linked,bank_name,bank_last4").eq("user_id", user.id).maybeSingle(),
    supabase.from("orders").select("id,status,seller_net_mxn,seller_net_after_processor_mxn,dresses(model),seller_payouts(status,amount_mxn,requested_at,paid_at)").eq("seller_id", user.id).order("created_at", { ascending: false }),
  ]);

  return <main className="page narrow">
    <h1>Pagos y retiros</h1>
    <section className="panel">
      <h2>Cuenta bancaria</h2>
      {paymentAccount?.bank_account_linked ? <>
        <p>Cuenta vinculada: {paymentAccount.bank_name ?? "Banco"} ···· {paymentAccount.bank_last4 ?? ""}</p>
        <p><span className="badge">{paymentAccount.payouts_enabled ? "Lista para retiros" : paymentAccount.onboarding_status}</span></p>
      </> : <>
        <p>Todavía no hay una cuenta bancaria vinculada.</p>
        <p className="muted">El botón de vinculación se activará al conectar Stripe Connect en el backend de producción. SECOND VOW no almacenará tu CLABE completa.</p>
      </>}
    </section>
    <h2>Saldos</h2>
    <PayoutsClient orders={orders ?? []} />
  </main>;
}
