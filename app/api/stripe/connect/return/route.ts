import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { syncStripeConnectAccount } from "@/lib/server/syncStripeConnect";

export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  if (!user) return NextResponse.redirect(`${site}/login`);
  const admin = createAdminClient();
  const { data: row } = await admin.from("seller_payment_accounts").select("provider_account_id").eq("user_id", user.id).maybeSingle();
  if (row?.provider_account_id) {
    try {
      await syncStripeConnectAccount(row.provider_account_id, user.id);
    } catch (error) {
      console.error("Stripe Connect return sync failed", error);
      return NextResponse.redirect(`${site}/cuenta/pagos?connect=sync_error`);
    }
  }
  return NextResponse.redirect(`${site}/cuenta/pagos?connect=returned`);
}
