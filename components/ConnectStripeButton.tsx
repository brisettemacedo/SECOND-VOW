"use client";

import { useState } from "react";

export default function ConnectStripeButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/stripe/connect/start", { method: "POST" });
      const text = await r.text();
      let payload: any = {};
      try { payload = text ? JSON.parse(text) : {}; } catch {}
      if (!r.ok) throw new Error(payload?.error || text || `Error ${r.status} al iniciar Stripe Connect.`);
      if (!payload?.url) throw new Error("Stripe no devolvió la página para vincular tu cuenta.");
      window.location.assign(payload.url);
    } catch (e: any) {
      setError(e?.message || "No fue posible iniciar la vinculación con Stripe.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="btn btn-primary" disabled={busy} onClick={start}>{busy ? "Abriendo Stripe…" : "Vincular cuenta bancaria"}</button>
    {error && <div className="alert-error" style={{ marginTop: 12 }}>{error}</div>}
  </>;
}
