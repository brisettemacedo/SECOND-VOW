# SECOND VOW — v1.8.4 producción candidata

Esta carpeta es la versión única de referencia del proyecto. Sustituye los ZIP anteriores.

## Estado de la base de datos

Las migraciones `0001` a `0021` son el historial del esquema. Aplica en orden `0022_correcciones_publicacion_pagos_cancelacion.sql`, `0023_expirar_sesion_stripe_antes_de_liberar.sql` y `0024_experiencia_unificada_admin.sql`, una sola vez cada una, después de todas las anteriores. No vuelvas a ejecutar migraciones anteriores. Ninguna de estas migraciones borra objetos de `storage.objects`.

**Importante sobre `0022`:** además de cambiar funciones hacia adelante, esta migración corrige de inmediato a usuarias existentes: cierra pedidos vencidos atorados (cancelándolos, liberando el vestido y sincronizando la oferta a `expired`/`cancelled`), corrige ofertas que quedaron marcadas "accepted" por error, restablece vestidos huérfanos en `reserved`, y publica automáticamente los borradores antiguos que ya estaban completos y solo esperaban que se resolviera su marca. Es segura de ejecutar una sola vez; si la vuelves a correr no debería encontrar nada más que corregir.

**Sobre `0023` — "primera en pagar gana", bloqueo vs. reembolso:** el checkout ya bloqueaba que dos pedidos estuvieran "en pago" al mismo tiempo para el mismo vestido (índice único). El hueco que corrige `0023` es distinto: cuando liberamos un pedido vencido en nuestra base, la página de pago de Stripe de esa compradora podía seguir abierta unos minutos más porque nunca le avisábamos a Stripe que la cerrara. Ahora, antes de liberar el vestido, el cron (`/api/cron/expire-payments` y `/api/cron/finalize`) le pide a Stripe que expire esa sesión — la compradora ve "esta sesión expiró" en vez de poder pagar. El reembolso automático (`backend_refund_losing_race_order`, disparado desde el webhook) queda solo como red de seguridad para el caso extremo de dos cobros casi simultáneos, que ningún bloqueo del lado del servidor puede prevenir al 100% con un checkout hospedado por Stripe.

**Sobre `0024`:** aceptar una oferta ya no reserva el vestido ni rechaza las demás. Puede haber varias cotizaciones y sesiones de pago; la confirmación de Stripe bloquea la fila del vestido y el primer pago válido gana. En ese momento el vestido cambia a `sold`, se cancelan pedidos no pagados, se rechazan las demás ofertas y el webhook expira las otras sesiones. También agrega la bandeja única de Administración, avisos de mejora a vendedoras, eliminación visible conservando historial transaccional cuando corresponde y el conteo de vestidos vinculados/publicados al resolver una marca.

También actualiza `vercel.json` para cerrar pedidos vencidos dos veces al día (7am y 7pm) en vez de una sola vez. **Cuidado:** en el plan Hobby de Vercel, un cron con una expresión que corra más de una vez al día hace que **todo el deployment falle** (no solo se ignora la frecuencia). Cada entrada en `crons` debe ser estrictamente una vez por día en Hobby; para cierres más frecuentes que eso se requiere plan Pro o superior.

## Variables de Vercel

Para correos transaccionales configura `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (por ejemplo, `SECOND VOW <avisos@second-vow.com>`). El dominio remitente debe estar verificado. Si faltan estas variables, los avisos permanecen en la bitácora y el sistema no simula un envío.

Configura en Vercel, para Production y Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

La aplicación también admite temporalmente `NEXT_PUBLIC_SUPABASE_ANON_KEY` como fallback, pero la publishable key es la opción preferida.

Nunca publiques `service_role`, claves secretas de Supabase ni una secret key de Stripe con prefijo `NEXT_PUBLIC_`.

## Funcionalidad sincronizada con 0001–0010

- Registro, login y recuperación de contraseña.
- Catálogo público: no requiere cuenta.
- Filtros en modal, sin ciudad ni estado.
- Marca, talla, precio, silueta, escote, espalda, mangas, tela, color y condición.
- Catálogos controlados leídos desde Supabase (`0007`), evitando texto libre para valores filtrables.
- Publicación de vestidos por pasos.
- Selección controlada de características y campo libre adicional de descripción.
- Fotografías en Storage.
- Favoritos.
- Mensajería y lectura de conversaciones.
- Ofertas finales de la vendedora por 48 horas, con envío fijo; aceptación, rechazo y cancelación mediante RPCs seguras. No hay contraofertas.
- Pedidos y envío manual con paquetería de libre elección y número de guía.
- Reclamación únicamente durante 72 horas desde la recepción registrada.
- Devolución autorizada: 5 días naturales para entregar a paquetería.
- Reputación e identidad según el esquema actual.
- Comisión: 18% del total de la oferta (vestido + envío), incluido el costo ordinario de Stripe. La vendedora recibe 82% del total y paga la guía con ese saldo.
- Estructura de saldos y retiros preparada para Stripe Connect.

## Stripe

`0018` implementa checkout atómico, idempotencia, conciliación de importes, pagos tardíos en revisión y eventos de reembolso/contracargo. No se incluyen secretos. Antes de aceptar dinero real configura el webhook de plataforma y eventos de cuentas conectadas conforme a `docs/PASO_A_PASO_LANZAMIENTO_HOY.md`.

La pantalla `/cuenta/pagos` muestra el estado del banco y saldos disponibles conforme a la base. La vinculación bancaria se mantiene inactiva hasta conectar Stripe Connect del lado servidor.

## Deploy

1. Copia el contenido completo de esta carpeta sobre el repositorio local `SECOND-VOW` (no sustituyas la carpeta `.git`).
2. GitHub Desktop → selecciona todos los cambios → `Commit to main`.
3. `Push origin`.
4. Vercel debe crear automáticamente un nuevo deployment desde `main`.
5. Verifica que el commit del deployment coincida con el commit más reciente de GitHub.

## Pruebas mínimas después del deploy

1. Sin iniciar sesión: `/`, `/vestidos`, filtros y ficha de un vestido aprobado.
2. Crear cuenta e iniciar sesión.
3. Crear borrador de vestido, seleccionar talla/características y escribir descripción libre.
4. Subir fotos y enviar a revisión.
5. Aprobar desde admin.
6. Abrir dos cuentas y probar mensaje → código postal → oferta final → aceptación → pedido → Stripe Test.
7. No probar pagos reales hasta completar la integración secreta de Stripe.


## Actualización v1.6.0

Si Supabase ya tiene 0001–0017 aplicadas, ejecuta **solamente** `supabase/migrations/0018_produccion_pagos_18_seguridad.sql`.

En Vercel agrega `NEXT_PUBLIC_SITE_URL` con la URL estable de producción y completa las variables legales indicadas en `.env.example`. En Supabase Authentication > URL Configuration, configura la misma URL estable como Site URL y agrega `https://TU-DOMINIO/**` como Redirect URL.

**Antes del lanzamiento comercial** sustituye `NEXT_PUBLIC_LEGAL_NAME` y `NEXT_PUBLIC_LEGAL_ADDRESS` por los datos exactos del responsable. No inventes esos datos.
