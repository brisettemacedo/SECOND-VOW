# Implementación 0014

## 1. Supabase SQL
Ejecutar una sola vez `supabase/migrations/0014_cotizacion_envio.sql` después de 0013.

Esta migración agrega la RPC `set_order_shipping_quote` para que la vendedora pueda indicar el costo de envío antes de que la compradora pague. No modifica 0011, 0012 ni 0013.

## 2. Confirmación de correo de Supabase
El error que termina en `localhost:3000/?code=...` no se corrige con SQL. Es configuración de Auth.

En Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `https://secondvow-seven.vercel.app`
- Redirect URLs: agregar `https://secondvow-seven.vercel.app/auth/callback`

Para probar deployments preview de Vercel, también puede agregarse un patrón de preview compatible con el slug de la cuenta. Para producción conviene conservar el URL exacto.

En Vercel, `NEXT_PUBLIC_SITE_URL` debe seguir siendo `https://secondvow-seven.vercel.app`.

## 3. Flujo de envío antes del pago
1. La vendedora acepta una oferta.
2. Se crea el pedido en `awaiting_payment`.
3. La vendedora abre el pedido y usa `Cotizar envío`.
4. La compradora ve el costo de envío y entonces se habilita `Pagar de forma segura`.
5. Stripe procesa el pago.
6. Después del pago, la vendedora registra paquetería y número de rastreo.
