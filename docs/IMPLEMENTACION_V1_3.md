# SECOND VOW v1.3.0

## Supabase
Ejecutar una sola vez, después de 0014:

`supabase/migrations/0015_operacion_segura_mensajes_admin.sql`

No volver a ejecutar 0001 a 0014.

0015 agrega evidencia privada asociada a pedidos y una función backend para preparar importes de checkout sin chocar con las restricciones de actualización de compradora/vendedora.

## GitHub / Vercel
Reemplazar el contenido visible del repositorio por esta versión, hacer Commit y Push a `main`.
No cambian las variables de entorno existentes.

## Cambios principales
- Ofertas vive dentro de Mensajes. `/ofertas` redirige a `/mensajes`.
- En chat el título del vestido es clicable y abre su ficha en otra pestaña.
- Oferta, contraoferta, pedido y cotización de envío aparecen en la conversación.
- Pedidos sigue separado para pago, envío, entrega, reclamación y liberación.
- Evidencia de vendedora y compradora queda asociada al pedido.
- Mensajes contextuales de seguridad desaconsejan citas y pagos fuera de SECOND VOW.
- El checkout calcula importes desde backend con service role.
- Administración usa diseño compacto y agrega pedidos, pagos y envíos al resumen operativo.
- Registro usa el origen real de la página para el callback de confirmación.
