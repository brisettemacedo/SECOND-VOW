# SECOND VOW — Marketplace MVP

Esta versión integra catálogo, publicación de vestidos, mensajería, ofertas, pedidos, registro de envío, reclamaciones, verificación de identidad, reputación y panel administrativo.

## Lo que funciona con Supabase
- Registro, login y recuperación de contraseña.
- Formulario de publicación en 10 pasos con borradores y fotografías.
- Moderación de vestidos.
- Favoritos.
- Mensajería en tiempo real.
- Ofertas y aceptación de ofertas.
- Creación de pedidos.
- Registro manual de paquetería y rastreo.
- Reclamaciones por incumplimiento dentro de 60 días.
- Solicitud y revisión de identidad.
- Calificaciones vinculadas a pedidos reales.

## Integraciones externas pendientes de credenciales y contrato
El código deja preparado el modelo de datos, pero no inventa una integración real con dinero o paqueterías. Antes de producción debes elegir y contratar:
- proveedor de pagos con marketplace/split payments;
- agregador o paquetería para generar guías y rastreo;
- proveedor KYC para verificación documental.

Hasta configurar pagos reales, los pedidos aceptados permanecen en `awaiting_payment`. No habilites transferencias por fuera de la plataforma.

## Supabase
En un proyecto nuevo ejecuta, en orden, todos los archivos de `supabase/migrations`.

## Vercel
Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o temporalmente `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Después conecta el repositorio y despliega.

## Administración
Registra tu cuenta y cambia su `profiles.role` a `admin` desde Supabase Table Editor. Entra a `/admin`.

## Política de operación incorporada
- Solo envío remoto; sin pruebas ni entrega presencial.
- Comisión base de 5% al aceptar oferta (ajustable en `accept_offer`).
- Reclamación únicamente por incumplimiento sustancial.
- Plazo de 60 días naturales desde la entrega.
- El vestido debe devolverse en el mismo estado recibido.
- Perfil público limitado a identidad verificada, rango de respuesta y calificación.


## Cambio 0006 — talla controlada y sin ubicación
Si ya ejecutaste 0001-0005, ejecuta únicamente `supabase/migrations/0006_talla_controlada_sin_ubicacion.sql`. La publicación usa una lista controlada de tallas y ciudad/estado dejan de ser requisitos del vestido.
