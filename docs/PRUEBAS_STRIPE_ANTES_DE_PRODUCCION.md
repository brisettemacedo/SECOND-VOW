# Pruebas Stripe antes de producción

Requieren Supabase de staging y Stripe Test Mode. No deben ejecutarse contra ventas reales.

1. Dos compradoras pagan simultáneamente el mismo vestido: una queda pagada y la otra se cancela/reembolsa.
2. Webhook pagado después del vencimiento: queda en revisión o reembolso y nunca habilita envío sin conciliación.
3. Cancelación mientras Checkout está abierto: la sesión expira y no admite cargo posterior.
4. Cancelación después del pago: se solicita reembolso completo y permanece bloqueado hasta confirmación.
5. Reembolso `processing` o fallido: conserva referencias, aparece en Administración y permite reintento idempotente.
6. Contracargo antes y después de transferencia: bloquea envío/retiro y registra la reversión cuando procede.
7. Transferencia creada y payout fallido: conserva `transfer_id` y reintenta solo el payout.
8. Webhook duplicado: no duplica pagos, saldos, eventos ni correos.
9. Stripe temporalmente no disponible: no libera reservas de forma insegura y muestra error recuperable.
10. Saldo insuficiente para reembolso: queda como excepción sin marcar el pedido como reembolsado.

## Criterio de aprobación

Conservar ID de pedido, eventos, respuestas HTTP, estados finales de `orders`, `payments`, `seller_payouts`, `payment_ledger`, `payment_exceptions`, `payment_webhook_events` y capturas del panel. Toda repetición debe producir el mismo resultado financiero.
