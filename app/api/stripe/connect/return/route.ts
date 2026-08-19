import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  if (!user) return NextResponse.redirect(`${site}/login`);
  const admin = createAdminClient();
  const { data: row } = await admin.from("seller_payment_accounts").select("provider_account_id").eq("user_id", user.id).maybeSingle();
  if (row?.provider_account_id) {
    const a = await stripeGet(`/accounts/${row.provider_account_id}`);
    const external = a?.external_accounts?.data?.[0];
    await admin.from("seller_payment_accounts").update({
      onboarding_status: a.details_submitted && a.payouts_enabled ? "complete" : a.details_submitted ? "restricted" : "pending",
      charges_enabled: !!a.charges_enabled, payouts_enabled: !!a.payouts_enabled, details_submitted: !!a.details_submitted,
      bank_account_linked: !!external, bank_name: external?.bank_name ?? null, bank_last4: external?.last4 ?? null,
      requirements_due: a?.requirements?.currently_due ?? [], verified_at: a.details_submitted && a.payouts_enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    await admin.from("profiles").update({ identity_verified: !!(a.details_submitted && a.payouts_enabled) }).eq("id", user.id);
  }
  return NextResponse.redirect(`${site}/cuenta/pagos?connect=returned`);
}
