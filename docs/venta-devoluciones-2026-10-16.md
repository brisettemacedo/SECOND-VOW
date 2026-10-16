# SECOND VOW, resolución de devoluciones, 16 de octubre de 2026

Autorización de la propietaria: mantener retenido el dinero hasta resolver el expediente, devoluciones internas excepcionales por defectos graves no declarados o diferencias sustanciales acreditadas, sin excluir derechos irrenunciables aplicables. La negativa injustificada de la vendedora no impide resolver un retorno autorizado.

## Flujo implementado

1. La compradora abre una reclamación, la vendedora conserva sus tres días naturales de respuesta y ambas partes pueden solicitar revisión de la decisión durante tres días.
2. Autorizar la devolución no ejecuta un reembolso, se mantiene el saldo retenido.
3. Administración confirma el destino completo, las instrucciones utilizables y la modalidad del flete, tras verificar disponibilidad con la paquetería.
4. En nuevas compras que acepten la versión 2026-10-16.1, si responde la vendedora, puede indicarse flete por cobrar al recibir, la compradora aporta el número de guía y el comprobante de admisión física. Si no hay cobertura se proporciona una guía prepagada, no se obliga a la compradora a adelantar el costo.
5. La compradora registra el retorno en los cinco días naturales siguientes a instrucciones utilizables y, si corresponde, la guía prepagada. Las operaciones anteriores conservan su modalidad prepagada cuando el flete corresponde a la vendedora.
6. Una etiqueta, una guía registrada, la recepción por rastreo o la confirmación de la vendedora no autorizan el pago automáticamente.
7. Administración revisa guía, comprobante o entrega acreditada, destino, evidencia e incidencias, documenta la solución y registra la verificación del retorno. No necesita un clic de aceptación de la vendedora, una negativa injustificada debe investigarse y documentarse, no se presume correcto cualquier paquete devuelto.
8. La acción de verificación no inventa una fecha de entrega ni ejecuta un reembolso. Mientras haya revisión abierta o contracargo sin conciliar, se bloquea el reembolso.
9. Con el expediente resuelto, administración autoriza por separado el reembolso íntegro al medio de pago original. La solicitud utiliza una clave de idempotencia para evitar duplicados. No es pago del vestido contra entrega por paquetería.
10. Los avisos de instrucciones, retorno registrado, verificación, cancelación por falta de envío, cierre y reembolso se registran para ambas partes, los eventos se reflejan en el historial y los correos se procesan con el despachador existente y su tarea programada. Configurar avisos no acredita por sí solo entrega de un correo.

## Controles económicos

- El rechazo provisional de una reclamación mantiene la retención hasta que venza la revisión o exista decisión final, la tarea programada restaura el flujo ordinario después de ese cierre.
- La recepción o registro del retorno no libera saldo a la vendedora.
- No se cambian importes ni se ejecutan cobros, transferencias o reembolsos sobre operaciones reales al instalar estos cambios.
- Se conservan las reglas previas de cargos, sin añadir un cargo por registrar la guía, sin duplicar el mismo flete.
- La retención exige expediente y gestiones documentadas, no una facultad de retención indefinida ajena a plazos y derechos legales.

## Administración

En Reclamaciones: resolver con motivo, compartir destino e instrucciones, revisar el expediente del pedido y las evidencias, marcar la verificación y escribir su fundamento, después usar la acción separada de autorizar reembolso. Un defecto menor o cambio de talla/gusto no habilita una devolución interna, los problemas de transporte y no recepción se investigan por su naturaleza.

## Verificación

- 32 pruebas automatizadas de aplicación, incluidas pruebas de la ruta de reembolso con Stripe simulado, sin pagos reales.
- Prueba transaccional `tests/sql/supervised-return.sql`, con registros sintéticos y ROLLBACK: permisos, envío por cobrar, comprobante obligatorio, plazo de revisión, dinero retenido, avisos bilaterales, idempotencia y retención durante rechazo provisional.
- La migración anterior de 13 de octubre fue una propuesta no aplicada, esta implementación la sustituye.
- Términos y política actualizados al 16 de octubre de 2026, versión 2026-10-16.1, manifiesto de archivos y hash conservados para nuevas aceptaciones.
