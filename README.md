# SECOND VOW — v1.0 unificada

Esta carpeta es la versión única de referencia del proyecto. Sustituye los ZIP anteriores.

## Estado de la base de datos

Las migraciones `0001` a `0010` incluidas en `supabase/migrations/` son el historial del esquema. Si ya fueron ejecutadas con éxito en el proyecto actual de Supabase, **NO se vuelven a ejecutar**. Cualquier cambio futuro debe añadirse como `0011`, `0012`, etc.

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
- Estructura de comisión: 15% + cargo administrativo fijo configurado en `0010`.
- Estructura de saldos y retiros preparada para Stripe Connect.

## Stripe

`0010` prepara la base de datos, pero no se incluyen claves secretas de Stripe en el repositorio. La activación real de cobros, onboarding bancario y webhooks debe hacerse desde rutas de servidor con variables secretas de Vercel antes de aceptar dinero real.

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
