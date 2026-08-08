# SECOND VOW — Implementación 0012

## Qué cambia

0012 consolida el modelo operativo elegido para SECOND VOW:

- la vendedora compra su propia guía;
- registra paquetería + número de rastreo;
- SECOND VOW crea un tracker en Ship24;
- Ship24 envía eventos por webhook;
- `buyer_confirmed_at` o `carrier_delivered_at`, el primero válido, fija `delivered_at`;
- `dispute_deadline_at = delivered_at + 72 horas`;
- una reclamación abierta antes del deadline bloquea la liberación;
- sin reclamación, el pedido se completa y el saldo se vuelve `releasable`;
- Stripe usa **separate charges and transfers**: el cobro entra primero a la plataforma y la transferencia a la vendedora se crea después de la protección.

## Supabase

Ejecutar **solo** `supabase/migrations/0012_pagos_tracking_72h.sql` después de 0011. No volver a ejecutar 0001–0011.

## Variables nuevas en Vercel

Secretas (sin `NEXT_PUBLIC_`):

- `SUPABASE_SERVICE_ROLE_KEY`
- `SHIP24_API_KEY`
- `SHIP24_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET`

Pública:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Ya debe existir:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Ship24

1. Crear/activar cuenta de Tracking API.
2. Copiar API key a `SHIP24_API_KEY` en Vercel.
3. Copiar el Webhook Secret a `SHIP24_WEBHOOK_SECRET`.
4. Configurar Webhook URL:
   `https://TU-DOMINIO/api/ship24/webhook`
5. El código usa `shipment.id` como `clientTrackerId` y guarda el `trackerId` devuelto por Ship24.
6. Solo `statusMilestone = delivered` acredita entrega. `available_for_pickup`, `failed_attempt` y `out_for_delivery` NO inician las 72 horas.
7. Los eventos se guardan por `occurrenceDatetime`; webhooks duplicados son idempotentes.

## Stripe Connect

1. Activar Connect en el Dashboard de Stripe y completar el perfil de plataforma.
2. Configurar branding del onboarding.
3. Copiar `sk_test_...` primero a `STRIPE_SECRET_KEY` (pruebas).
4. En Developers > Webhooks crear endpoint:
   `https://TU-DOMINIO/api/stripe/webhook`
5. Suscribir al menos:
   - `checkout.session.completed`
   - `payout.paid`
   - `payout.failed`
6. Copiar el signing secret `whsec_...` a `STRIPE_WEBHOOK_SECRET`.
7. Probar todo en modo Test antes de sustituir por llaves Live.

## Flujo monetario

1. La vendedora completa Stripe Connect y vincula su banco.
2. La compradora paga en Stripe Checkout.
3. El webhook marca el pedido `paid`.
4. La vendedora envía y registra tracking.
5. Entrega confirmada por compradora o Ship24.
6. Corren 72 horas.
7. Al vencer las 72 horas sin reclamación: `seller_payouts.status = releasable`.
8. La vendedora pulsa “Solicitar retiro”.
9. SECOND VOW crea un Stripe Transfer desde el cargo original hacia la cuenta conectada.
10. SECOND VOW crea el payout bancario en la cuenta conectada.

## Comisión configurada

- publicación: $0;
- comisión vendedora: 15% del precio del vestido;
- cargo administrativo: $19 MXN;
- envío: lo paga la compradora y se entrega íntegro a la vendedora;
- comisión porcentual no se calcula sobre envío;
- en 0012 el costo de procesamiento de Stripe queda a cargo de la plataforma hasta que se adopte otra decisión comercial explícita.

## Cron

`vercel.json` ejecuta `/api/cron/finalize` cada hora. La finalidad es cerrar ventanas de 72 horas vencidas y volver liberables los saldos. Configurar `CRON_SECRET` en Vercel.

## Prueba mínima antes de Live

Usar dos cuentas de prueba (compradora y vendedora), Stripe Test Mode y un tracking de muestra de Ship24. Verificar: onboarding → pago → envío → webhook delivered → deadline → reclamación bloquea pago / ausencia de reclamación libera → retiro.
