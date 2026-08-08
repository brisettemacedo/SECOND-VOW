import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeRequest } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data: existing } = await admin.from("seller_payment_accounts").select("provider_account_id").eq("user_id", user.id).maybeSingle();
  let accountId = existing?.provider_account_id as string | undefined;
  if (!accountId) {
    const p = new URLSearchParams();
    p.set("type", "express"); p.set("country", "MX");
    p.set("email", user.email ?? "");
    p.set("business_type", "individual");
    p.set("business_profile[product_description]", "Venta de vestido de novia de segunda mano mediante SECOND VOW");
    p.set("settings[payouts][schedule][interval]", "manual");
    const account = await stripeRequest("/accounts", p);
    accountId = account.id;
    await admin.from("seller_payment_accounts").upsert({ user_id: user.id, provider: "stripe", provider_account_id: accountId, onboarding_status: "pending" });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const p = new URLSearchParams();
  p.set("account", accountId!); p.set("type", "account_onboarding");
  p.set("refresh_url", `${site}/cuenta/pagos?connect=refresh`);
  p.set("return_url", `${site}/api/stripe/connect/return`);
  const link = await stripeRequest("/account_links", p);
  return NextResponse.json({ url: link.url });
}
