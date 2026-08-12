# v1.1 — 2026-08-07

- Migración 0011 incremental; 0001–0010 permanecen congeladas.
- Aviso de Privacidad integral y simplificado, Términos y Cookies.
- Footer, FAQ, contacto y páginas informativas.
- Registro con aceptación legal versionada.
- Declaraciones de vendedora por publicación con timestamp.
- Sugerencias de marca y resolución administrativa (crear/vincular/rechazar).
- Panel admin ampliado: publicaciones, marcas, identidad, usuarias, reportes, ARCO, reclamaciones y exportación CSV.
- Identidad: distintivo comercial y eliminación del documento al resolver verificación.
- Corrección de checkboxes y callback estable de autenticación.

# Changelog

## v1.0 — 2026-08-07

- Consolidación del frontend más reciente con migraciones 0001–0010.
- Catálogo público sin ciudad/estado.
- Filtros modales y catálogos controlados obtenidos desde Supabase.
- Tallas controladas en búsqueda y publicación.
- Selección de características del vestido + descripción libre adicional.
- Ofertas migradas a RPCs seguras de 0008, incluidas contraofertas.
- Mensajería usa `mark_conversation_read` de 0007.
- Envíos/reclamaciones migrados a RPCs de 0009.
- Reclamación limitada a 72 horas desde recepción; devolución autorizada con 5 días naturales para entregar a paquetería.
- Vista de pagos/retiros alineada con 0010.
- Eliminación de archivos `.DS_Store` y artefactos de TypeScript.

## v1.2 — 0012
- Modelo Stripe cambiado a separate charges and transfers.
- Endpoints de Connect onboarding, Checkout, webhook y payout.
- Integración Ship24: alta de tracker y webhook autenticado.
- `buyer_confirmed_at` y `carrier_delivered_at`; el primero fija `delivered_at`.
- Ventana de reclamación de 72 horas y cierre automático horario.
- Tracking events idempotentes y ordenados por fecha real del evento.
- Nuevo texto de Quiénes somos solicitado para SECOND VOW.

## v1.2.2 — 0013
- UX-01: validación obligatoria por paso y resumen final de pendientes.
- Panel `/admin/publicaciones` protegido por rol admin.
- Vista administrativa completa con fotografías, datos y declaraciones.
- Moderación trazable: aprobar/publicar, solicitar cambios y rechazar.
- Motivo obligatorio para cambios/rechazo.
- Estado y comentarios de moderación visibles para la vendedora.
- Re-edición y reenvío de publicaciones con cambios solicitados.

## v1.2.3 — corrección frontend
- El panel `/admin` muestra las publicaciones pendientes con acceso directo a la solicitud completa.
- `/admin/publicaciones/[id]` mantiene la revisión completa de fotografías, datos, declaraciones e historial.
- UX-01 reforzado: avisos visibles por paso, listado concreto de campos faltantes y bloqueo del botón de envío mientras exista cualquier requisito pendiente.
- Validación adicional contra los datos realmente persistidos en Supabase antes de cambiar a `pending_review`.
- El error técnico `dresses_completa_antes_de_revision` deja de mostrarse a la vendedora y se sustituye por el listado de requisitos faltantes.
- Corrección de un input duplicado en el formulario de publicación.

## v1.2.4 — 2026-08-12
- Ficha administrativa robusta con consultas separadas.
- UX-01 reforzada y visible.
- Guardados accesibles desde navegación y cuenta.
- Limpieza visual de modelo no aplicable.

## v1.2.5 — 2026-08-12

- Eliminadas consultas PostgREST ambiguas entre `dresses` y `brand_suggestions`.
- Mis vestidos preserva publicaciones en cualquier estado y distingue errores de listas vacías.
- Administración resuelve marcas en consultas separadas y deja de reportar falsamente “sin pendientes” cuando falla una consulta.
- Stripe Connect ahora captura y muestra errores de backend/Stripe y valida la URL de onboarding.


## v1.2.6 — 2026-08-12
- Borrado de borradores propios desde Mis vestidos.
- Tipografía unificada en DM Sans.
- Paleta Olive Leaf, Cornsilk y Black Forest.
- Eliminación de guiones largos en textos visibles.


## v1.2.7 — 2026-08-12
- Wordmark SECOND VOW en serif editorial; interfaz funcional conserva DM Sans.
- Contadores de pendientes en Mensajes, Ofertas y Pedidos.
- Campos de oferta y contraoferta con monto visible y etiquetado.
- Flujo de cotización de envío por la vendedora antes del pago.
- La compradora ve la cotización y solo puede pagar cuando exista.
- Limpieza de modelos `na` en mensajes, ofertas y pedidos.
- Migración 0014 para cotización segura de envío.
