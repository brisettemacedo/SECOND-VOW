# SECOND VOW v1.3.1 - salida pública

1. Ejecutar `supabase/migrations/0016_lanzamiento_publico_ship24.sql`.
2. En Vercel agregar `SHIP24_API_KEY` y `SHIP24_WEBHOOK_SECRET` para Production.
3. En Ship24 configurar webhook: `https://secondvow-seven.vercel.app/api/ship24/webhook`.
4. En Ship24 usar su prueba de webhook y después un sample tracking oficial.
5. Configurar Google y Facebook en Supabase Auth antes de dejar esos botones al público.
6. Verificar Stripe Connect de la vendedora y webhook Stripe antes de aceptar dinero real.
7. Hacer prueba completa con dos cuentas: compradora y vendedora.
