# SECOND VOW v1.6.0 — despliegue seguro

## 1. Antes de subir

1. Ejecuta `npm install` para generar `package-lock.json` con las versiones exactas de `package.json`.
2. Ejecuta `npm run typecheck`, `npm run lint` y `npm run build`.
3. No continúes si cualquiera falla.

## 2. Supabase

Si 0001–0017 ya están aplicadas, ejecuta únicamente `supabase/migrations/0018_produccion_pagos_18_seguridad.sql`. La migración cambia la comisión a 18%, elimina el cargo fijo, hace atómico el Checkout, agrega revisión de pagos tardíos, reembolsos, devoluciones y rate limits.

Configura Authentication con el dominio real:

- Site URL: `https://TU-DOMINIO`
- Redirect URL: `https://TU-DOMINIO/auth/callback`

## 3. Vercel

Copia todas las variables de `.env.example`. Usa valores TEST en Preview y LIVE en Production. `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHIP24_API_KEY` y `SHIP24_WEBHOOK_SECRET` nunca llevan prefijo `NEXT_PUBLIC_`.

El build de producción falla intencionalmente si faltan URL, identidad/domicilio legal, teléfono o correos obligatorios. Después de cambiar variables realiza un deployment nuevo del commit actual.

## 4. Stripe

Configura `/api/stripe/webhook` para eventos de plataforma y eventos de cuentas conectadas. Suscribe como mínimo:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `refund.created`, `refund.updated`, `refund.failed`
- `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
- `transfer.reversed`
- `payout.paid`, `payout.failed`, `payout.canceled`
- `account.updated`

El secret debe corresponder exactamente a ese endpoint y modo. El Checkout inicial acepta tarjeta para evitar pagos diferidos que sobrevivan a la reserva. Prueba primero con claves TEST.

## 5. Vercel Cron

`vercel.json` ejecuta una vez al día los cierres y expiraciones compatibles con Hobby. Vercel debe enviar `Authorization: Bearer CRON_SECRET`; si falta el secreto, los endpoints responden 401. Los webhooks de Stripe son la vía primaria para liberar sesiones vencidas.

## 6. Ship24

Configura `/api/ship24/webhook` con su secreto. Registra un número de prueba y confirma que el evento de entrega inicia exactamente la ventana de 72 horas.

## 7. Prueba integral obligatoria

1. Registro, correo, login y recuperación.
2. Publicación, imágenes, moderación y catálogo público.
3. Mensaje, oferta, aceptación y cotización.
4. Dos compradoras intentando pagar el mismo vestido: solo una debe obtener Checkout.
5. Doble clic en pagar: debe reutilizar una sola sesión.
6. Pago exitoso y evento duplicado: un solo pago, ledger y saldo.
7. Sesión vencida y visita a la ficha: liberación después del margen de seguridad.
8. Pago tardío simulado: `payment_review`, sin habilitar envío.
9. Envío, entrega, 72 horas y liberación de saldo.
10. Reclamación, devolución en cinco días, recepción y reembolso.
11. Contracargo: saldo pausado y excepción administrativa.
12. Retiro, falla y reintento sin duplicar transferencia.

No actives pagos LIVE hasta completar todos los casos y conciliar importes contra el Dashboard de Stripe.
