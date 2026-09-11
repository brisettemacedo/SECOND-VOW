import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeRequest, stripeV2Post } from "@/lib/server/stripe";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("seller_payment_accounts")
      .select("provider_account_id,account_api_version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    let accountId = existing?.provider_account_id as string | undefined;
    let accountApiVersion = existing?.account_api_version === "v2" ? "v2" : "v1";
    if (!accountId) {
      const displayName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || "Vendedora SECOND VOW").trim().slice(0, 100);
      const account = await stripeV2Post("/core/accounts", {
        display_name: displayName,
        ...(user.email ? { contact_email: user.email } : {}),
        dashboard: "express",
        defaults: {
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        identity: {
          country: "MX",
          entity_type: "individual",
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        metadata: { second_vow_user_id: user.id },
      }, `second_vow_connect_account_v2_${user.id}`);
      accountId = account.id;
      accountApiVersion = "v2";
      const { error: upsertError } = await admin.from("seller_payment_accounts").upsert({
        user_id: user.id,
        provider: "stripe",
        provider_account_id: accountId,
        account_api_version: accountApiVersion,
        onboarding_status: "pending",
      });
      if (upsertError) throw new Error(upsertError.message);
    }

    const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const origin = configuredSite || new URL(request.url).origin;
    let link: any;
    if (accountApiVersion === "v2") {
      link = await stripeV2Post("/core/account_links", {
        account: accountId!,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            refresh_url: `${origin}/cuenta/pagos?connect=refresh`,
            return_url: `${origin}/api/stripe/connect/return`,
          },
        },
      });
    } else {
      const p = new URLSearchParams();
      p.set("account", accountId!);
      p.set("type", "account_onboarding");
      p.set("refresh_url", `${origin}/cuenta/pagos?connect=refresh`);
      p.set("return_url", `${origin}/api/stripe/connect/return`);
      link = await stripeRequest("/account_links", p);
    }

    if (!link?.url) throw new Error("Stripe no devolvió una URL de vinculación.");
    return NextResponse.json({ url: link.url });
  } catch (e: any) {
    console.error("Stripe Connect start error", e);
    return NextResponse.json({ error: e?.message || "No fue posible iniciar la vinculación con Stripe." }, { status: 500 });
  }
}
