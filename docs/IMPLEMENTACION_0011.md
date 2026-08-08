# SECOND VOW — Implementación 0011

## Qué cambia

- Registro con aceptación versionada de Aviso de Privacidad, Términos y autorización de tratamiento.
- Declaraciones de la vendedora antes de enviar un vestido a revisión.
- Sugerencia de marcas con resolución administrativa: crear, vincular o rechazar.
- Solicitudes ARCO desde la cuenta y gestión administrativa.
- Distintivo “Identidad verificada” y eliminación del documento al resolver la revisión.
- Panel administrativo ampliado: publicaciones, marcas, identidad, usuarias, reportes, ARCO, reclamaciones y exportación CSV.
- Footer y páginas públicas: Aviso Integral, Aviso Simplificado, Términos, Cookies, Contacto, FAQ, Quiénes somos y Cómo funciona.
- Callback de autenticación usa una URL estable mediante NEXT_PUBLIC_SITE_URL.
- Corrección CSS de checkboxes.

## Supabase

Si 0001–0010 ya están aplicadas, ejecutar SOLO:

`supabase/migrations/0011_cumplimiento_marcas_admin_seguridad.sql`

No volver a ejecutar 0001–0010.

## Vercel

Agregar o actualizar:

- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_LEGAL_NAME
- NEXT_PUBLIC_LEGAL_ADDRESS
- NEXT_PUBLIC_LEGAL_PHONE
- NEXT_PUBLIC_PRIVACY_EMAIL
- NEXT_PUBLIC_CONTACT_EMAIL

Además conservar las variables públicas de Supabase ya configuradas.

## Supabase Authentication

En Authentication > URL Configuration:

- Site URL = la misma URL estable usada en NEXT_PUBLIC_SITE_URL.
- Redirect URLs = `https://TU-DOMINIO/**` y, si quieres desarrollo local, `http://localhost:3000/**`.

## Datos legales pendientes

No se inventaron razón social, domicilio ni teléfono. Deben completarse antes del lanzamiento comercial. El Aviso de Privacidad requiere identificar al responsable y su domicilio.
