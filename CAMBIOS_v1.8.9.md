# SECOND VOW v1.8.9

## Correcciones

- “Aceptar y continuar al pago” llama exclusivamente a `accept_offer` y abre el pedido creado.
- “Rechazar” y “Cancelar oferta pendiente” usan funciones independientes.
- La vendedora puede cancelar una oferta mientras siga pendiente.
- Solo puede existir una oferta pendiente por conversación, tanto en interfaz como en base de datos.
- El formulario para enviar otra oferta queda oculto mientras existe una pendiente.
- El mensaje para cotizar envío se simplificó y ya no explica comisiones.
- Los estados históricos `countered`, `declined` y `rejected` se muestran en español.
- Se eliminaron los guiones largos de los textos modificados.
- El nombre visible ya no puede contener un correo electrónico o una URL.
- Los nombres históricos con apariencia de correo o URL se ocultan en mensajes y en la vista pública.

## Despliegue

1. Ejecutar `supabase/migrations/0029_corregir_ofertas_y_nombres_publicos.sql` en Supabase.
2. Subir esta versión a GitHub y esperar el despliegue de Vercel.
3. Probar aceptar, rechazar y cancelar con dos cuentas distintas.

La migración 0029 es obligatoria. El cambio de interfaz por sí solo no reemplaza las funciones antiguas que ya están instaladas en Supabase.
