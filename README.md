Secondvow nuevo proyecto
# SecondVow — Guía de lanzamiento (Fase 2 + 3 + 4)

Checklist único, en orden. No necesitas saber programar — cada paso es
crear una cuenta, pegar un archivo, o copiar/pegar un texto.

## Qué vas a necesitar comprar (resumen)

| Cosa | Costo | ¿Obligatorio para lanzar? |
|---|---|---|
| Cuenta GitHub | Gratis | Sí |
| Cuenta Supabase | Gratis para empezar | Sí |
| Cuenta Vercel | Gratis para empezar | Sí |
| Dominio propio (secondvow.mx / .com) | ~$300 MXN/año | No — puedes lanzar con el link gratis de Vercel primero |
| Cuenta Stripe | Ya la tienes | Se conecta después (Fase 8, pagos) |

## Paso 1 — Sube el proyecto a GitHub

1. github.com → crea tu cuenta si no la tienes.
2. "New repository" → nómbralo `secondvow` → **Private** → Create.
3. Descomprime `secondvow-app.zip` → arrastra todo el contenido de la
   carpeta `secondvow-app` a tu repositorio nuevo → Commit.

## Paso 2 — Crea el proyecto en Supabase

1. supabase.com → New Project → nómbralo `secondvow`.
2. Guarda la contraseña de base de datos que te pida.

## Paso 3 — Corre las tres migraciones, EN ORDEN

1. SQL Editor → New query → pega `supabase/migrations/0001_fase2_base_tecnica.sql` → Run.
2. New query → pega `0002_fase3_catalogo.sql` → Run.
3. New query → pega `0003_fase4_favoritos_perfil.sql` → Run.

El orden importa: cada una depende de la anterior.

## Paso 4 — Copia tus llaves de conexión

Project Settings > API → copia **Project URL** y **anon public key**.

## Paso 5 — Publica en Vercel

1. vercel.com → New Project → importa tu repositorio `secondvow`.
2. En Environment Variables agrega `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy.

## Paso 6 — Activa la recuperación de contraseña (un ajuste dentro de Supabase)

1. Supabase → **Authentication > URL Configuration**.
2. En "Redirect URLs" agrega la URL de tu sitio + `/actualizar-password`
   (ej. `https://secondvow.vercel.app/actualizar-password`).
   Sin este paso, el link del correo de "olvidé mi contraseña" no va a
   funcionar en producción.

## Paso 7 — Pruébalo

- Crea una cuenta, confirma tu correo, inicia sesión.
- Entra a `/vestidos` (catálogo vacío por ahora — normal, ver más abajo).
- Prueba "¿Olvidaste tu contraseña?" desde `/login`.
- Entra a `/cuenta` y edita tu nombre/ciudad.

## Paso 8 — Conviértete en administradora

Supabase → Table Editor → tabla `profiles` → tu fila → `role` de `user` a `admin`.

---

## Qué es real en esta entrega (Fase 4 recién agregada)

- **Favoritos de verdad**: el botón "Guardar" en cada tarjeta y en la
  ficha del vestido escribe en la base de datos.
- **La acción pendiente se conserva**: si alguien sin cuenta da clic en
  "Guardar", se le pide iniciar sesión o registrarse, y al terminar
  regresa exactamente a la misma página con el vestido ya guardado —
  incluso si tuvo que confirmar su correo primero.
- **Mis favoritos** (`/favoritos`): lista los vestidos guardados, y si
  alguno ya no está disponible, lo sigue mostrando con su estado en vez
  de desaparecerlo silenciosamente (como pide la especificación).
- **Perfil público de vendedora** (`/vendedoras/[id]`): solo datos
  públicos (nombre, ciudad, desde cuándo, publicaciones activas) —
  nunca correo ni teléfono.
- **Mi cuenta** (`/cuenta`): editar nombre/ciudad/estado, cambiar
  contraseña, cerrar sesión.
- **Recuperar contraseña** (`/recuperar` → correo → `/actualizar-password`).

## El vacío real que sigue existiendo

El catálogo sigue vacío porque el formulario de publicación (Fase 5)
aún no existe — decidiste seguir el orden de fases sin datos de prueba,
así que esto se resuelve naturalmente en la Fase 5.

## Qué sigue

- Fase 5: formulario de publicación por pasos + fotos + moderación
- Fase 6: mensajería entre compradora y vendedora
- Fase 7: panel de administración real
- Fase 8: pagos con Stripe Connect
