# SECOND VOW: venta y devoluciones, 13 de octubre de 2026

> Documento histórico, el flujo autorizado y activado el 16 de octubre se describe en [venta-devoluciones-2026-10-16.md](venta-devoluciones-2026-10-16.md), prevalece esa actualización para el estado actual de implementación.

## Hallazgo en el pedido de prueba

Pedido 26f5dca6-e884-49c3-851f-1680e4d3bdd2: pago de $1,100, vestido $1,000 y envío $100, comisión calculada $198, saldo previsto $902. Reembolso completo registrado por $1,100 el 9 de octubre, sin guía de ida ni reclamación en ese pedido, motivo shipping_deadline_expired. Los $902 no fueron otro reembolso. El resumen corregido muestra importe reembolsado a la compradora y saldo de esta venta para la vendedora de $0, con cargos separados solo cuando realmente existan.

## Flujo normal

1. Conversar dentro de SECOND VOW y confirmar disponibilidad, medidas, alteraciones, estado y accesorios.
2. La compradora comparte su nombre, teléfono y destino, preferentemente sucursal identificada por paquetería, nombre y dirección completa. La cercanía no garantiza servicio ni entrega exclusiva a la titular.
3. La vendedora confirma cobertura, entrega con identificación, costo y plazo estimado, emite oferta con vestido más envío. La oferta y el pedido sin pagar tienen sus plazos propios de 48 horas.
4. Pago confirmado: comienza el plazo de cinco días naturales para registrar la guía. No se envía ante revisión o riesgo abierto.
5. Registrar guía y entregar físicamente a paquetería, conservar admisión y evidencia. Una etiqueta creada no acredita admisión, una guía falsa o de otro destino requiere investigación y bloqueo.
6. Sin guía en cinco días: bloqueo de registro tardío, cancelación operativa y solicitud de reembolso completo. Las revisiones programadas se cambian de diarias a cada hora, no prometen abono bancario al mismo minuto del vencimiento.
7. Entrega válida registrada por SECOND VOW: 48 horas para revisión y reporte interno. Tener guía o estar listo para recoger no equivale a entrega.
8. Sin reclamación activa: venta concluida y saldo liberable, retiro sujeto a cuenta bancaria habilitada y controles de riesgo.

## Devolución por incumplimiento de la vendedora

Criterios añadidos a términos: manchas o daño relevante no informado, roturas o cierres defectuosos, vestido diferente, falsificación, medidas materialmente falsas o alteraciones ocultas, accesorios prometidos ausentes, condición nueva falsamente anunciada. Desgaste claramente declarado o simple cambio de gusto/ajuste no equivalen al mismo supuesto. Las 48 horas son una ventana operativa, no una renuncia a derechos legales.

Reclamación, saldo retenido, respuesta de vendedora hasta tres días naturales, resolución motivada y revisión hasta tres días. No enviar una devolución sin instrucciones.

### Modalidad solicitada por Brisette y preparada, pendiente de aprobación de la migración

- Vendedora proporciona guía en dos días naturales, asume el flete, preferentemente por cobrar al recibir cuando la ruta y paquetería admitan esa modalidad; en otro caso guía prepagada.
- Compradora no adelanta el flete y entrega a paquetería dentro de cinco días desde la guía utilizable.
- Vendedora recibe y paga el retorno contratado por cobrar.
- SECOND VOW confirma retorno y finalización de revisión, solicita reembolso del pago original completo, incluido envío de ida cuando el incumplimiento se atribuya a vendedora.
- El reembolso no consiste en efectivo entregado por paquetería, Stripe lo tramita al medio original. Una negativa injustificada documentada puede requerir confirmación administrativa, no da veto unilateral a la vendedora.
- No cargar dos veces el mismo flete ni acumular comisión ordinaria y cargo por incumplimiento de la misma operación. El cargo del 18% por incumplimiento ya previsto solo aplica por decisión motivada y aceptación correspondiente, el 4% por falta de envío es un supuesto distinto.

La modalidad actualmente instalada sigue siendo guía prepagada. La revisión automática rechazó cambios persistentes en funciones, permisos y estados financieros de producción. La migración 20261013234148_order_lifecycle_and_collect_returns.sql está preparada, NO aplicada. Los avisos adicionales a ambas partes, el registro automático de cancelación/cierre y la confirmación administrativa del retorno dependen de esa migración. La interfaz desplegada no llama a RPC inexistentes.

## Casos reales investigados y reglas de respuesta

- Manchas de autobronceador o amarillamiento ocultos y tintorería antes de reclamar: conservar estado y documentar antes de limpiar, investigar el defecto original y cualquier intervención posterior, no negar automáticamente por una limpieza.
- Vendedora sostiene que envió sin manchas y compradora aporta manchas: comparar evidencia contemporánea de empaque/apertura, no dar por cierta automáticamente ninguna versión.
- Medidas de etiqueta diferentes de medidas tras ajustes: solicitar medidas reales de prenda y alteraciones, no equiparar error de talla corporal con descripción falsa.
- Guía creada sin depósito, guía reutilizada o destino incorrecto: pedir comprobante de admisión y verificar trayectoria, no liberar dinero por solo existir un número.
- Listo para recoger, persona distinta o negativa de recogida: verificar quién recibió, autorización y constancia, no iniciar inspección por solo llegar a sucursal.
- Paquete perdido, vacío o dañado en tránsito: investigación de transporte, embalaje, peso, seguro y contenido, sin exigir devolver algo no recibido ni esperar indefinidamente una indemnización.
- Retorno de vestido distinto, usado, alterado o sin accesorios: revisión motivada antes de reembolso, sin veto unilateral a la vendedora.
- Vendedora rechaza retorno por cobrar o no paga: constancia de rechazo y confirmación administrativa documentada propuesta.
- Reembolso interno y contracargo bancario simultáneos: conciliar estados para evitar dos abonos, bloquear retiro mientras corresponda.
- Boda próxima o retraso: distinguir fecha estimada de compromiso expreso, prevenir compra con margen insuficiente.

## Fuentes

- https://www.estafeta.com/terminos-y-condiciones (ocurre permite identificación y representante con carta poder).
- https://www.estafeta.com/indemnizaciones (plazos de reporte y prueba de empaque/daño).
- https://www.paquetexpress.com.mx/documentos/solicitud-de-servicios.pdf (flete por cobrar en destino a cargo del destinatario, sujeto al servicio).
- https://docs.stripe.com/refunds (solicitud/confirmación bancaria, usualmente 5 a 10 días hábiles para tarjeta).
- https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes (reembolsos desde saldo de la plataforma).
- https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf (arts. 1, 56, 92 y 93, aplicación según naturaleza y sujetos).
- https://www.reddit.com/r/weddingdress/comments/1dzomfr/learn_from_my_stillwhite_mistake/ (testimonio no adjudicado, manchas ocultas y tintorería).
- https://www.reddit.com/r/weddingdress/comments/1qb1uay/still_white_issue/ (testimonio no adjudicado, disputa sobre manchas tras envío).
- https://www.reddit.com/r/weddingplanning/comments/1sv3gfe/received_a_misrepresented_dress_from_stillwhite/ (testimonio, medidas/ajustes).

Los testimonios sirven para identificar escenarios, no acreditan fraude ni permiten atribuir responsabilidades sin investigar cada expediente.
