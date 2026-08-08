import crypto from "node:crypto";

const BASE = "https://api.stripe.com/v1";
function secret() { if (!process.env.STRIPE_SECRET_KEY) throw new Error("Falta STRIPE_SECRET_KEY"); return process.env.STRIPE_SECRET_KEY; }

export async function stripeRequest(path: string, params: URLSearchParams, connectedAccount?: string) {
  const headers: Record<string,string> = {
    Authorization: `Bearer ${secret()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (connectedAccount) headers["Stripe-Account"] = connectedAccount;
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

export function verifyStripeSignature(rawBody: string, signature: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !signature) return false;
  const parts = Object.fromEntries(signature.split(",").map(p => p.split("=") as [string,string]));
  if (!parts.t || !parts.v1) return false;
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
