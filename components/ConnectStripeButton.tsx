"use client";
import { useState } from "react";
export default function ConnectStripeButton() {
  const [busy,setBusy]=useState(false);
  async function start(){setBusy(true);const r=await fetch("/api/stripe/connect/start",{method:"POST"});const j=await r.json();setBusy(false);if(!r.ok)alert(j.error||"No fue posible iniciar la vinculación");else window.location.href=j.url;}
  return <button className="btn btn-primary" disabled={busy} onClick={start}>{busy?"Abriendo Stripe…":"Vincular cuenta bancaria"}</button>;
}
