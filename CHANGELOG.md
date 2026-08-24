# v1.6.0 — 2026-08-17
- Comisión total de 18% sobre vestido; incluye procesamiento Stripe, sin cargo fijo y sin comisión sobre envío.
- Checkout atómico e idempotente; bloqueo de doble venta y reutilización de sesión.
- Pagos tardíos/conflictivos pasan a revisión sin habilitar envío.
- Webhooks ampliados: expiración, pagos asíncronos, fallas, reembolsos, contracargos, transferencias, payouts y cuentas Connect.
- Devolución rastreable, confirmación de recepción y reembolso administrativo.
- Stripe Connect sustituye nuevas cargas manuales de identificación.
- Crons cerrados cuando falta `CRON_SECRET`, rate limiting y encabezados de seguridad.
- Next.js 15.5.21 Maintenance LTS y React 19.2.4 con parches de seguridad.
- Migración incremental 0018; 0001–0017 permanecen intactas.

# v1.3.0
- Ofertas integradas en Mensajes y /ofertas redirige a Mensajes.
- Título del vestido clicable en chat y pedidos.
- Cotización de envío visible en conversación.
- Evidencia de envío y recepción asociada al pedido.
- Mensajes contextuales de seguridad y recomendación de mantener operación dentro de SECOND VOW.
- Checkout usa snapshot financiero backend seguro.
- Dashboard admin compacto con pedidos, pagos, envíos y usuarias.
- Callback de registro usa el origen actual del sitio.
- Nueva migración 0015.

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

## v1.3.1 - 2026-08-12
- Ship24 preparado para tracker + webhook y referencias por pedido.
- Google/Facebook OAuth en login y registro.
- Vendedora y compradora visibles en mensajes/pedidos.
- Folio amigable SV-AAAA-######.
- Estados de pedido humanizados y tracking visible.
- Corrección crítica: importes enviados a Stripe convertidos de MXN a centavos en Checkout, Transfer y Payout.
# v1.7.0 — 2026-08-22
- Ventana de reclamación de 48 horas desde que SECOND VOW registra la entrega.
- Devolución solo por información falsa o materialmente incorrecta, incluido daño relevante no informado; no procede porque el vestido no quede.
- Cinco días naturales para envío y solicitud automática de reembolso Stripe al vencer.
- Ship24 acredita entrega de salida y devolución sin inicio retroactivo del plazo.
- Bloqueo de envío y retiro ante Radar, alerta temprana de fraude o contracargo.
- Avisos persistentes, seguro y firma obligatorios desde $10,000 MXN.
- Checkboxes transaccionales, políticas de envíos/devoluciones y preferencias de cookies.
- Un solo proceso diario compatible con Vercel Hobby.
# v1.7.1 — 2026-08-24
- La vendedora puede cancelar antes del envío con motivo obligatorio.
- Antes del pago se cancela el pedido; durante Checkout se expira la sesión; después del pago se solicita reembolso completo a Stripe.
- Se impide cancelar unilateralmente después del envío o durante un contracargo/revisión para evitar devoluciones duplicadas.
- El vestido vuelve a publicarse únicamente cuando Stripe confirma el reembolso.
# v1.8.0 — 2026-08-24
- Nueva portada con jerarquía editorial, CTA de catálogo y cuatro beneficios.
- Sección para captar inventario y explicar la comisión de 18% y el 82% de la vendedora.
- Calculadora interactiva de recuperación con descuento ajustable y aclaración sobre el envío.
- Diseño responsivo para escritorio y móvil.
# v1.8.1 — 2026-08-24
- Corregida una regla global que reducía a 14 px las líneas internas del titular del hero.
- Titular ampliado y equilibrado para escritorio y móvil, con mejor contraste sobre fotografía.
