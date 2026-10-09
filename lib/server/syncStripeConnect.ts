import { createAdminClient } from "@/lib/server/adminSupabase";
import { stripeGet, stripeV2Get } from "@/lib/server/stripe";
import { stripeConnectState } from "@/lib/server/stripeConnectState";

export async function syncStripeConnectAccount(accountId: string, expectedUserId?: string) {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new Error("Cuenta Stripe inválida");
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("seller_payment_accounts")
    .select("user_id,account_api_version").eq("provider_account_id", accountId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return;
  if (expectedUserId && row.user_id !== expectedUserId) throw new Error("Cuenta Stripe no autorizada");
  const [legacy, accountV2] = await Promise.all([
    stripeGet(`/accounts/${accountId}`),
    row.account_api_version === "v2"
      ? stripeV2Get(`/core/accounts/${accountId}?include[0]=configuration.recipient&include[1]=requirements`)
      : Promise.resolve(undefined),
  ]);
  const state = stripeConnectState(legacy, accountV2);
  const { error: accountError } = await admin.from("seller_payment_accounts").update({
    ...state,
    verified_at: state.onboarding_status === "complete" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("provider_account_id", accountId).eq("user_id", row.user_id);
  if (accountError) throw new Error(accountError.message);
  const { error: profileError } = await admin.from("profiles").update({ identity_verified: state.onboarding_status === "complete" }).eq("id", row.user_id);
  if (profileError) throw new Error(profileError.message);
}
