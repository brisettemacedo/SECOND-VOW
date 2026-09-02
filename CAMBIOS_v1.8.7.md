# SECOND VOW 1.8.7 — piloto de oferta y pago

## Instalación

1. Subir el código a GitHub y esperar el despliegue de Vercel.
2. Ejecutar en Supabase `supabase/migrations/0028_piloto_ofertas_checkout_imagenes.sql` después de `0027`.
3. Probar Stripe en modo Test antes de cobros reales.

## Reglas vigentes

- Solo la vendedora crea una oferta; incluye vestido y envío fijo según el código postal.
- Comisión del 18% sobre vestido + envío. La vendedora recibe 82% del total y paga la guía con ese saldo.
- Una oferta y un pedido activos por conversación. No hay contraofertas.
- Oferta y plazo de pago duran 48 horas; un Checkout cerrado puede reintentarse dentro del plazo.
- Abrir Checkout no oculta el vestido. El primer pago confirmado gana.
- La vendedora puede cancelar una oferta pendiente.
- Hay notificaciones al recibir la oferta y recordatorios a 12 h y 1 h. Para puntualidad exacta hace falta invocar la función con una frecuencia mayor que el cron diario de Vercel Hobby.
- El permiso de campañas con fotografías es opcional y revocable para usos futuros.
