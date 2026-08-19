import crypto from "node:crypto";

const BASE = "https://api.stripe.com/v1";
function secret() { if (!process.env.STRIPE_SECRET_KEY) throw new Error("Falta STRIPE_SECRET_KEY"); return process.env.STRIPE_SECRET_KEY; }

export async function stripeRequest(path: string, params: URLSearchParams, connectedAccount?: string, idempotencyKey?: string) {
  const headers: Record<string,string> = {
    Authorization: `Bearer ${secret()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (connectedAccount) headers["Stripe-Account"] = connectedAccount;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: params.toString(), cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe respondió ${res.status}`);
  return json;
}

export async function stripeGet(path: string, connectedAccount?: string) {
  const headers: Record<string,string> = { Authorization: `Bearer ${secret()}` };
  if (connectedAccount) headers["Stripe-Account"] = connectedAccount;
  const res = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe respondió ${res.status}`);
  return json;
}

export async function stripePost(path: string, params = new URLSearchParams(), connectedAccount?: string, idempotencyKey?: string) {
  return stripeRequest(path, params, connectedAccount, idempotencyKey);
}

export function verifyStripeSignature(rawBody: string, signature: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !signature) return false;
  const entries = signature.split(",").map((part) => part.split("=", 2) as [string, string]);
  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  return signatures.some((candidate) => {
    const b = Buffer.from(candidate);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
