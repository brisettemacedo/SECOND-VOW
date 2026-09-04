# Entrega contra identificación: funcionamiento práctico

## Lo que ya controla SECOND VOW

La compradora comparte en el chat privado su nombre completo y un domicilio o sucursal. La vendedora lo ve para cotizar. Al aceptar la oferta se crea una copia del destino en el pedido y ya no puede cambiarse unilateralmente. Antes del pago, la compradora acepta la entrega contra identificación y firma. Antes de registrar la guía, la vendedora confirma seguro, firma y entrega contra identificación, y debe haber subido tres evidencias mínimas.

## Lo que depende de la paquetería

“Entrega contra identificación” no corresponde necesariamente al mismo producto en DHL, FedEx, Estafeta, UPS u ocurre en sucursal. Algunas guías solo ofrecen firma; otras permiten nombre de destinataria, retención en sucursal o servicios especiales. SECOND VOW no debe afirmar que verificó una identificación si el transportista únicamente reporta `delivered`.

Antes de automatizarlo se debe elegir una lista de servicios aceptados por paquetería y comprobar qué campos entrega cada API: nombre de quien recibió, firma, prueba de entrega y enlace al comprobante. Ship24 agrega rastreo, pero la disponibilidad de la prueba de entrega depende del transportista fuente.

## Implementación posterior

Cuando se definan las paqueterías admitidas, `shipments` ya tiene campos para marcar identificación obligatoria y conservar nombre/referencia de prueba de entrega. Un adaptador por transportista deberá enlazar la constancia, comparar destinataria y generar una alerta administrativa si falta firma o el nombre no coincide. No se almacenará copia de la identificación oficial.
