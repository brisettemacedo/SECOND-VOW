import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeRequest } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("seller_payment_accounts")
      .select("provider_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    let accountId = existing?.provider_account_id as string | undefined;
    if (!accountId) {
      const p = new URLSearchParams();
      p.set("type", "express");
      p.set("country", "MX");
      if (user.email) p.set("email", user.email);
      p.set("business_type", "individual");
      p.set("business_profile[product_description]", "Venta de vestido de novia de segunda mano mediante SECOND VOW");
      p.set("settings[payouts][schedule][interval]", "manual");
      const account = await stripeRequest("/accounts", p);
      accountId = account.id;
      const { error: upsertError } = await admin.from("seller_payment_accounts").upsert({
        user_id: user.id,
        provider: "stripe",
        provider_account_id: accountId,
        onboarding_status: "pending",
      });
      if (upsertError) throw new Error(upsertError.message);
    }

    const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const origin = configuredSite || new URL(request.url).origin;
    const p = new URLSearchParams();
    p.set("account", accountId!);
    p.set("type", "account_onboarding");
    p.set("refresh_url", `${origin}/cuenta/pagos?connect=refresh`);
    p.set("return_url", `${origin}/api/stripe/connect/return`);
    const link = await stripeRequest("/account_links", p);

    if (!link?.url) throw new Error("Stripe no devolvió una URL de vinculación.");
    return NextResponse.json({ url: link.url });
  } catch (e: any) {
    console.error("Stripe Connect start error", e);
    return NextResponse.json({ error: e?.message || "No fue posible iniciar la vinculación con Stripe." }, { status: 500 });
  }
}
