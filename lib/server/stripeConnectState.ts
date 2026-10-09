// V1 remains necessary for external bank accounts. V2 capabilities are authoritative
// for recipient readiness, not the ability to charge cards on the seller account.
export function stripeConnectState(legacy: any, accountV2?: any) {
  const bank = legacy.external_accounts?.data?.find((item: any) => item.object === "bank_account" && item.currency === "mxn")
    ?? legacy.external_accounts?.data?.find((item: any) => item.object === "bank_account");
  const balance = accountV2?.configuration?.recipient?.capabilities?.stripe_balance;
  if (accountV2 && !balance?.stripe_transfers) throw new Error("Stripe no devolvió las capacidades de la cuenta receptora.");
  const transfersActive = accountV2 ? balance.stripe_transfers.status === "active" : legacy.capabilities?.transfers === "active";
  const payoutsEnabled = Boolean(legacy.payouts_enabled && (!accountV2 || balance.payouts?.status === "active"));
  const ready = Boolean(!accountV2?.closed && legacy.details_submitted && bank && transfersActive && payoutsEnabled);
  const requirements = accountV2
    ? (accountV2.requirements?.entries ?? []).filter((entry: any) => entry.awaiting_action_from === "user" && ["currently_due", "past_due"].includes(entry.minimum_deadline?.status)).map((entry: any) => entry.description)
    : legacy.requirements?.currently_due ?? [];
  return {
    onboarding_status: ready ? "complete" : legacy.details_submitted ? "restricted" : "pending",
    charges_enabled: Boolean(legacy.charges_enabled),
    payouts_enabled: ready,
    details_submitted: Boolean(legacy.details_submitted),
    bank_account_linked: Boolean(bank),
    bank_name: bank?.bank_name ?? null,
    bank_last4: bank?.last4 ?? null,
    requirements_due: requirements,
  };
}
