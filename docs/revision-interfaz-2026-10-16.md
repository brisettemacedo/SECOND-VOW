# Revisión de interfaz y funciones, 16 de octubre de 2026

## Correcciones de esta revisión

- Conversación con altura limitada a la pantalla, scroll interno y cabecera y área de respuesta separadas del historial, abre en lo más reciente y conserva la posición cuando se revisan mensajes anteriores.
- Aviso de conversación finalizada con espacio, texto separado y acción de ver pedido.
- Eliminar publicación desde el editor, con salida a Mis vestidos, cancelación del autoguardado durante la eliminación y validación en base de datos que impide borrar con venta abierta.
- Las ofertas aceptadas históricas de operaciones canceladas o reembolsadas ya no bloquean por sí solas la eliminación.
- Contador de mensajes por persona con pendientes, agrupa distintos mensajes y conversaciones de la misma remitente, no incluye envíos propios ni conversaciones ajenas accesibles por el rol administrador.
- El contador usa el cursor de lectura real de cada usuaria, la conversación inicial y los mensajes recibidos en el chat visible se marcan al leer, actualiza al recibir mensajes, cambiar lectura, recuperar foco y mediante comprobación periódica.
- Se descartan respuestas de carga antiguas al cambiar rápidamente entre conversaciones.

## Qué se retiró en cambios anteriores del historial reciente

Estos cambios corresponden a las instrucciones visibles de la propietaria:

| Cambio | Referencia del historial |
|---|---|
| Paso que solo informaba que el envío se cotiza después, formulario reducido a cuatro pasos | ca68b08 |
| Botón de guardado manual, sustituido por creación al terminar el primer paso y autoguardado posterior | d41180c |
| Tres descripciones separadas de daños y ajustes, unificadas en un cuadro | f262951 |
| Cuadros de protección de compra, seguridad de la operación y compra y conversa con seguridad | f16f76b, e5f9b23, e533d3d |
| Casillas adicionales de seguro, firma y conservación de evidencia en el registro de envío, simplificadas según instrucción | e5f9b23 |
| Cancelación manual de venta por la vendedora | e5f9b23 |
| Autorización manual de saldo para retiro, reemplazada por disponibilidad del saldo | d0ae85d |
| Secciones Desglose del pago, Actividad del pedido y Referencias para soporte | 3017cc0 |
| Respuestas rápidas de cotización después de pago, reclamación o reembolso | 452a89d |
| Botón flotante de cookies que tapaba controles en celular, se conserva el acceso en el pie de página | d3a7702 |

El bloqueo de chats de ventas terminadas fue implementado en 5cf4ef2, el historial se conserva y los estados de reclamación y devolución siguen disponibles para conversar mientras la operación se resuelve.

## Alcance de la revisión

Se comparó el historial reciente relacionado con las solicitudes de esta conversación, no se afirma una auditoría funcional exhaustiva de todas las versiones del proyecto. En los cambios recientes examinados no aparece la eliminación explícita de un scroll acotado del chat, el CSS conserva overflow pero carecía de altura limitada y restricciones flex que lo hicieran funcionar correctamente. Esta revisión corrige el comportamiento observado en las capturas.

Las comprobaciones transaccionales de contador y eliminación están en tests/sql/inbox-and-listing-removal.sql, usan datos temporales y ROLLBACK, no modifican las publicaciones reales.
