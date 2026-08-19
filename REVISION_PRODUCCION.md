# Revisión de producción — SECOND VOW v1.6.0

Fecha: 17 de agosto de 2026.

## Decisión económica vigente

- Publicación gratuita.
- Comisión total: 18% del precio del vestido.
- El costo ordinario de Stripe está incluido en ese 18% y lo absorbe SECOND VOW.
- Sin cargo administrativo fijo.
- El envío se cobra a la compradora, se transfiere a la vendedora y no genera comisión porcentual.

## Correcciones incorporadas

- Migración incremental 0018; no modifica 0001–0017 ya aplicadas.
- Reserva atómica de vestido y pedido, más índice contra dos checkouts simultáneos.
- Idempotencia en Checkout, transferencias, payouts, ledger y reembolsos.
- Margen de seguridad antes de liberar sesiones vencidas.
- Pago tardío, monto distinto, moneda distinta o vestido ocupado pasan a `payment_review`; nunca habilitan el envío automáticamente.
- Webhooks para expiración, fallas, reembolsos, contracargos, reversos, payouts y actualización de cuentas Connect.
- Flujo de devolución: autorización, guía, recepción y reembolso al medio original.
- Reintento de payout sin duplicar la transferencia previa.
- `CRON_SECRET` obligatorio, rate limiting, validación de origen y encabezados HTTP de seguridad.
- Nuevas verificaciones de identidad delegadas a Stripe Connect; no se reciben copias manuales nuevas.
- Los documentos manuales históricos no se eliminan directamente mediante SQL; cualquier depuración debe ejecutarse posteriormente con la Storage API de Supabase.
- Términos y Aviso de Privacidad actualizados.
- Next.js 15.5.21 Maintenance LTS y React 19.2.4.

## Verificación realizada en esta entrega

- JSON de configuración válido.
- `next.config.mjs` válido para Node.
- Imports internos resueltos.
- Historial completo de 18 migraciones y pares de delimitadores PL/pgSQL verificados.
- Búsqueda de tarifas antiguas: permanecen únicamente en migraciones históricas y documentación marcada como histórica.

## Verificación que debe ejecutar GitHub/Vercel

El entorno donde se preparó el ZIP no permitió descargar paquetes de npm, por lo que no pudo generarse `package-lock.json` ni ejecutarse el compilador real. El workflow incluido ejecuta instalación, typecheck, lint y build. Antes de producción, el commit debe quedar verde y debe conservarse el `package-lock.json` generado por `npm install`.

## Condiciones para activar LIVE

No usar Stripe LIVE hasta completar todos los casos de `docs/PASO_A_PASO_LANZAMIENTO_HOY.md`, verificar el webhook de plataforma y cuentas conectadas, llenar todas las variables legales y conciliar una operación completa de prueba.
