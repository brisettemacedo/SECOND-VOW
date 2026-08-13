# SECOND VOW v1.3.1 - paso a paso para lanzamiento

## 1. Supabase
1. SQL Editor > New query.
2. Copia y ejecuta `supabase/migrations/0016_lanzamiento_publico_ship24.sql`.
3. Authentication > URL Configuration:
   - Site URL: `https://secondvow-seven.vercel.app`
   - Redirect URL: `https://secondvow-seven.vercel.app/auth/callback`
4. Para login social, configura Providers > Google y/o Facebook antes de activar los botones.

## 2. Vercel
En Settings > Environment Variables, Production debe tener al menos:
- `NEXT_PUBLIC_SITE_URL=https://secondvow-seven.vercel.app`
- `SHIP24_API_KEY=<tu API key de Ship24>`
- `SHIP24_WEBHOOK_SECRET=<tu Webhook Secret de Ship24>`
- variables existentes de Supabase
- variables existentes de Stripe

No expongas secretos con prefijo `NEXT_PUBLIC_`.

Para mostrar Google/Facebook después de configurarlos en Supabase:
- `NEXT_PUBLIC_SOCIAL_LOGIN_ENABLED=true`

Después de cambiar variables: Redeploy.

## 3. Ship24
1. Dashboard > API keys: copia tu API key a Vercel como `SHIP24_API_KEY`.
2. Dashboard > Webhook: usa `https://secondvow-seven.vercel.app/api/ship24/webhook`.
3. Copia el Webhook Secret a Vercel como `SHIP24_WEBHOOK_SECRET`.
4. Usa primero la función de prueba del webhook del Dashboard.
5. Para probar un tracker sin paquete real, Ship24 documenta números de muestra como `SHIP24_SAMPLE_DELIVERED_000` y `SHIP24_SAMPLE_IN_TRANSIT_000`.
6. En SECOND VOW, después de un pedido pagado, la vendedora registra paquetería + guía. SECOND VOW crea el tracker en Ship24 y guarda el trackerId.

## 4. Stripe
1. La vendedora debe entrar a Cuenta > Pagos y retiros y completar Stripe Connect.
2. El botón de pago no se habilita funcionalmente si la vendedora no tiene onboarding completo y payouts habilitados.
3. Confirma que Production usa claves LIVE y que `STRIPE_WEBHOOK_SECRET` corresponde al endpoint LIVE de producción.
4. Webhook de producción debe apuntar a `https://secondvow-seven.vercel.app/api/stripe/webhook`.
5. Para pruebas sin dinero real, usa un Preview Deployment con claves TEST de Stripe. No mezcles claves TEST y LIVE en Production.

## 5. GitHub / Vercel
1. Sustituye el proyecto por esta carpeta.
2. Commit: `SECOND VOW v1.3.1 - lanzamiento publico`.
3. Push origin.
4. Verifica que Vercel cree automáticamente un deployment del commit nuevo.
5. No hagas Redeploy de un commit viejo.

## 6. Prueba final mínima antes de compartir el enlace
- crear cuenta y confirmar correo;
- iniciar sesión;
- publicar vestido y aprobarlo desde admin;
- guardar vestido;
- enviar mensaje;
- hacer / aceptar oferta;
- cotizar envío;
- comprobar que el botón Pagar abre Stripe;
- comprobar webhook de Stripe;
- registrar tracking Ship24;
- comprobar webhook de Ship24;
- comprobar 72 h / reclamación con un pedido de prueba antes de operar un caso real.
