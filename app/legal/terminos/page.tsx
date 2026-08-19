import { CONTACT_EMAIL, LEGAL_NAME, TERMS_VERSION } from "@/lib/site";

export default function Terms() {
  return <main className="legal-page">
    <h1>Términos y Condiciones</h1>
    <p className="legal-meta">Versión {TERMS_VERSION}</p>
    <p>Estos Términos regulan el acceso y uso de SECOND VOW, operado por <strong>{LEGAL_NAME}</strong>. Contacto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Al crear una cuenta o utilizar funciones reservadas aceptas estas reglas y la versión registrada para cada operación.</p>

    <h2>1. Naturaleza del servicio</h2>
    <p>SECOND VOW es un marketplace tecnológico especializado en vestidos de novia de segunda mano. Salvo indicación expresa, SECOND VOW no adquiere la propiedad ni se convierte en vendedor del artículo. La compraventa se celebra entre compradora y vendedora; SECOND VOW presta servicios de publicación, comunicación, moderación, pago, reputación, seguimiento y gestión de incidencias. SECOND VOW responde por sus propias obligaciones como proveedor de la plataforma, sin excluir derechos irrenunciables previstos en la legislación mexicana.</p>

    <h2>2. Capacidad y cuenta</h2>
    <p>Las usuarias deben ser mayores de edad y contar con capacidad legal para contratar. La información proporcionada debe ser veraz y mantenerse actualizada. Cada usuaria responde por la confidencialidad de sus credenciales y debe reportar accesos no autorizados. SECOND VOW puede limitar o suspender cuentas por fraude, incumplimiento, riesgo de seguridad, contracargos abusivos o información falsa.</p>

    <h2>3. Obligaciones de la vendedora</h2>
    <p>Al enviar un vestido a revisión, la vendedora declara que es propietaria o está autorizada para venderlo; que es auténtico y de procedencia lícita; que las fotografías corresponden al artículo; y que informó con veracidad marca, medidas, modificaciones, condición, daños, accesorios y demás características relevantes. Debe conservar evidencia razonable del vestido, empaque y entrega a paquetería.</p>
    <p>La vendedora concede a SECOND VOW una licencia no exclusiva y temporal para alojar, adaptar técnicamente, mostrar y promocionar las fotografías y textos de la publicación mientras sea necesario para operar la plataforma y documentar una transacción o controversia.</p>

    <h2>4. Autenticidad, marcas y contenido prohibido</h2>
    <p>Las marcas pertenecen a sus titulares y su mención no implica afiliación. Se prohíben artículos ilícitos, robados o falsificados; fotografías sin autorización; descripciones engañosas; ocultamiento de daños; suplantación; acoso; spam; fraude; manipulación de precios y uso de la plataforma para evadir deliberadamente comisiones o mecanismos de seguridad. SECOND VOW puede pedir evidencia, retirar publicaciones y colaborar con autoridades.</p>

    <h2>5. Ofertas, pedido y reserva</h2>
    <p>La aceptación de una oferta genera un pedido y concede a la compradora el plazo indicado para iniciar el pago, normalmente 24 horas. <strong>La aceptación por sí sola no reserva el vestido.</strong> El vestido se reserva únicamente cuando la compradora inicia el Checkout de Stripe y la plataforma confirma que continúa disponible. La sesión de pago dura aproximadamente 60 minutos. Si vence sin pago confirmado, el vestido puede liberarse. La pantalla de regreso del navegador no constituye por sí sola confirmación de pago o cancelación; prevalecen los eventos conciliados con Stripe.</p>

    <h2>6. Precio y comisión</h2>
    <p>Publicar es gratuito. En una venta concluida, la vendedora paga a SECOND VOW una comisión total equivalente al <strong>18% del precio del vestido</strong>. Esa comisión ya contempla el costo ordinario de procesamiento de Stripe, por lo que no se agrega a la vendedora una comisión separada por pagar con tarjeta ni un cargo administrativo fijo. La comisión porcentual no se calcula sobre el envío. Los importes aplicables se muestran antes del pago y quedan fijados para el pedido correspondiente.</p>

    <h2>7. Pagos, saldo y retiros</h2>
    <p>Los pagos se procesan mediante Stripe u otro proveedor habilitado. SECOND VOW no conserva números completos de tarjeta ni credenciales bancarias completas. El saldo de la vendedora permanece retenido durante el envío y la ventana de reclamación. Si no existe reclamación activa y termina el periodo de protección, el saldo puede liberarse para retiro a la cuenta bancaria vinculada.</p>
    <p>Un pago recibido después de vencer o liberarse una reserva no autoriza automáticamente el envío: se coloca en revisión para confirmar disponibilidad o tramitar reembolso. SECOND VOW puede pausar saldos ante fraude, devolución, reclamación, contracargo, orden de autoridad o error de procesamiento.</p>

    <h2>8. Envío</h2>
    <p>SECOND VOW no ofrece pruebas ni entregas presenciales. La vendedora cotiza y contrata una paquetería con rastreo, registra la guía y embala adecuadamente el vestido. El costo del envío puede cobrarse a la compradora y transferirse a la vendedora sin comisión porcentual. Para operaciones de alto valor podrá exigirse seguro, firma de recepción o evidencia adicional. La responsabilidad por pérdida o daño se determinará conforme a la evidencia, cobertura contratada, obligaciones de las partes y legislación aplicable.</p>

    <h2>9. Recepción y reclamaciones</h2>
    <p>La compradora debe revisar el paquete y el vestido lo antes posible. Dispone de <strong>72 horas desde la recepción registrada</strong> para reportar dentro de la plataforma un incumplimiento sustancial, por ejemplo: artículo equivocado, falsificación, daño relevante no declarado, diferencia material respecto de la publicación, modificación relevante no informada, medidas materialmente incorrectas o ausencia de un componente incluido. El cambio de opinión o que el vestido no quede como esperaba no constituye por sí mismo incumplimiento.</p>
    <p>SECOND VOW puede solicitar fotografías, video, medidas, etiquetas, empaque, comunicaciones y seguimiento. El plazo operativo de la plataforma no limita derechos que legalmente resulten irrenunciables.</p>

    <h2>10. Devoluciones y reembolsos</h2>
    <p>Si SECOND VOW autoriza una devolución, la compradora debe entregar el vestido a la paquetería dentro de <strong>5 días naturales</strong>, con rastreo y sustancialmente en el estado recibido, salvo el defecto reclamado. La resolución indicará quién cubre el envío de devolución atendiendo a la causa y responsabilidad. El reembolso se procesa al medio de pago original una vez cumplidas las condiciones aplicables; los tiempos bancarios dependen de Stripe y de la institución emisora.</p>

    <h2>11. Cancelaciones, falta de envío y contracargos</h2>
    <p>Antes del pago confirmado, el pedido puede expirar conforme al flujo disponible. Después del pago, la cancelación unilateral solo procede por causa legal, incumplimiento o supuesto expresamente autorizado. Si la vendedora no envía dentro del plazo, SECOND VOW puede cancelar y reembolsar. Las usuarias deben colaborar primero con el mecanismo de reclamación; un contracargo no elimina las obligaciones derivadas de fraude, abuso o devolución del artículo.</p>

    <h2>12. Moderación, seguridad y pagos externos</h2>
    <p>SECOND VOW puede aprobar, pedir cambios, rechazar, archivar o retirar publicaciones y limitar cuentas ante reportes fundados, falsificación, fraude o riesgos de seguridad. La moderación no constituye certificación absoluta de autenticidad o calidad. Los pagos y acuerdos efectuados fuera de SECOND VOW carecen de la trazabilidad y protección operativa de la plataforma.</p>

    <h2>13. Propiedad intelectual y avisos</h2>
    <p>El nombre, interfaz, software y contenidos propios de SECOND VOW están protegidos. Los titulares de derechos pueden reportar material presuntamente infractor al correo de contacto, identificando la obra o marca, la publicación y el fundamento de su solicitud.</p>

    <h2>14. Datos personales</h2>
    <p>El tratamiento de datos se rige por el Aviso de Privacidad vigente. La aceptación de estos Términos no sustituye consentimientos específicos legalmente necesarios.</p>

    <h2>15. Cambios, ley y autoridades</h2>
    <p>Los cambios se aplican a operaciones futuras y se identificarán mediante una nueva versión; cuando corresponda se solicitará nueva aceptación. Estos Términos se interpretan conforme a las leyes de México. Permanecen a salvo los derechos irrenunciables de las usuarias y la competencia de las autoridades administrativas o jurisdiccionales correspondientes.</p>
  </main>;
}
