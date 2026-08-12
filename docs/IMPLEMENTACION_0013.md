# SECOND VOW — Implementación 0013

## Qué agrega

- UX-01: validación obligatoria por paso en el formulario de publicación.
- Resumen final de campos pendientes antes de enviar a revisión.
- `/admin` protegido por `profiles.role = 'admin'`.
- `/admin/publicaciones` con publicaciones `pending_review`.
- Vista administrativa completa de cada vestido y sus fotografías.
- Moderación mediante RPC segura: aprobar/publicar, solicitar cambios o rechazar.
- Motivo obligatorio para `changes_requested` y `rejected`.
- Historial de moderación con administrador, fecha, estado anterior/nuevo y comentarios.
- Estado y comentarios visibles para la vendedora en `/mis-vestidos`.
- Re-edición y reenvío cuando el estado sea `changes_requested`.

## Orden de instalación

1. En Supabase SQL Editor, ejecutar **solo** `supabase/migrations/0013_admin_moderacion.sql`.
2. No volver a ejecutar 0001–0012.
3. Asegurar que tu cuenta de SECOND VOW tenga `profiles.role = 'admin'` (bootstrap inicial, una sola vez).
4. Subir esta versión a GitHub y desplegar en Vercel.

## Bootstrap inicial de administrador

La protección de `/admin` usa exclusivamente `profiles.role = 'admin'`. Si tu cuenta aún es `user`, el sistema te redirige al inicio aunque la interfaz administrativa exista.

Ejecuta una sola vez en Supabase, sustituyendo el correo por el correo de TU cuenta de SECOND VOW:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'TU_CORREO_DE_SECOND_VOW'
);
```

Comprueba:

```sql
select p.id, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
```

Después de esto, cierra sesión y vuelve a entrar en SECOND VOW. El menú mostrará `Administración` y `/admin` quedará accesible para tu usuario.

## Nota sobre el estado de publicación

El esquema existente 0001–0012 utiliza `approved` como estado interno de una publicación visible y todas las políticas, ofertas e índices dependen de ese valor. Para no romper el marketplace ni reescribir migraciones previas, 0013 conserva `approved` internamente y la interfaz lo presenta a la vendedora como **Publicado**. El botón administrativo se llama **Aprobar y publicar** y hace el vestido visible inmediatamente mediante el flujo ya existente.

## Corrección v1.2.3

Si `0013_admin_moderacion.sql` ya fue ejecutada correctamente, **no vuelvas a ejecutarla** para instalar v1.2.3. Esta versión corrige únicamente frontend:

- avisos obligatorios visibles por paso;
- validación contra los datos realmente guardados antes de enviar;
- eliminación del error técnico de check constraint para la vendedora;
- acceso directo desde `/admin` a la solicitud completa;
- ficha administrativa con vendedora, fechas, todos los datos y fotografías.
