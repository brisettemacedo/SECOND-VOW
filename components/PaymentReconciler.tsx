"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentReconciler({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("Estamos confirmando tu pago de forma segura…");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/stripe/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
        const body = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && body.reconciled) { setMessage("Pago confirmado. Preparando los siguientes pasos…"); router.refresh(); }
        else setMessage("Stripe aún está confirmando el pago. No vuelvas a pagar; actualiza esta página en unos minutos.");
      } catch {
        if (active) setMessage("La confirmación está tardando. No vuelvas a pagar; conservamos la referencia de tu operación.");
      }
    })();
    return () => { active = false; };
  }, [orderId, router]);

  return <div className="alert-info" role="status">{message}</div>;
}
