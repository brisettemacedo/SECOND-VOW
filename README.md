# SECOND VOW — v1.8.1 producción candidata

Esta carpeta es la versión única de referencia del proyecto. Sustituye los ZIP anteriores.

## Estado de la base de datos

Las migraciones `0001` a `0020` son el historial del esquema. Si ya ejecutaste `0019`, aplica únicamente `0020_cancelacion_vendedora.sql`. Si aún no ejecutaste `0019`, aplica primero `0019` y después `0020`. No vuelvas a ejecutar migraciones anteriores. Ninguna de estas migraciones borra objetos de `storage.objects`.

## Variables de Vercel

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
- Ofertas de 48 horas, contraofertas, aceptación y rechazo mediante RPCs seguras.
- Pedidos y envío manual con paquetería de libre elección y número de guía.
- Reclamación únicamente durante 72 horas desde la recepción registrada.
- Devolución autorizada: 5 días naturales para entregar a paquetería.
- Reputación e identidad según el esquema actual.
- Comisión total a la vendedora: 18% del precio del vestido; incluye el costo ordinario de Stripe. Sin cargo administrativo fijo y sin comisión sobre el envío.
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
6. Abrir dos cuentas y probar mensaje → oferta → contraoferta/aceptación → pedido.
7. No probar pagos reales hasta completar la integración secreta de Stripe.


## Actualización v1.6.0

Si Supabase ya tiene 0001–0017 aplicadas, ejecuta **solamente** `supabase/migrations/0018_produccion_pagos_18_seguridad.sql`.

En Vercel agrega `NEXT_PUBLIC_SITE_URL` con la URL estable de producción y completa las variables legales indicadas en `.env.example`. En Supabase Authentication > URL Configuration, configura la misma URL estable como Site URL y agrega `https://TU-DOMINIO/**` como Redirect URL.

**Antes del lanzamiento comercial** sustituye `NEXT_PUBLIC_LEGAL_NAME` y `NEXT_PUBLIC_LEGAL_ADDRESS` por los datos exactos del responsable. No inventes esos datos.
