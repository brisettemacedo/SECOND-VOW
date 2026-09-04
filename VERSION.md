# SECOND VOW v1.9.1

Integra destino privado en el chat, snapshot al aceptar oferta, nombre completo de recepción, comisión configurable del 18% sobre vestido y envío, protocolo obligatorio de seguro/firma/identificación y evidencias mínimas.

Agrega correos transaccionales con Resend y bitácora de reintentos, expediente financiero administrativo, liberación manual segura del saldo, búsqueda y página paginada de pedidos, comentarios y estrellas reales, indicador de ventas concluidas sin reclamación y huella SHA-256 de la documentación aceptada.

Actualiza Términos, privacidad, envíos, FAQ y flujo informativo para vestidos usados y vestidos nuevos no utilizados. La integración automática con la prueba de entrega de cada paquetería queda documentada como pendiente de definición.

Incluye las migraciones incrementales `0030_envio_domicilio_comision_admin_correos.sql` y `0031_reclamacion_no_recibido.sql`. Deben ejecutarse en ese orden después de `0029`.

La versión 1.9.1 aclara que una venta personal aislada no convierte automáticamente a la vendedora en comerciante ni obliga por sí sola a entregar RFC. También habilita la reclamación cuando la guía aparece entregada pero la compradora niega haber recibido el paquete; el saldo queda bloqueado mientras se revisa la constancia de entrega.
