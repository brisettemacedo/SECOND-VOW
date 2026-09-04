import { TERMS_VERSION } from "@/lib/site";

export default function ShippingPolicy() {
  return <main className="legal-page">
    <h1>Política de envíos y seguimiento</h1>
    <p className="legal-meta">Versión {TERMS_VERSION}</p>
    <h2>Destino para cotización</h2>
    <p>La compradora comparte privadamente en la conversación su nombre completo y el domicilio o sucursal de paquetería donde recibirá. La vendedora utiliza esa información exclusivamente para cotizar y ejecutar el envío. Al aceptar la oferta, el destino queda vinculado al pedido.</p>
    <h2>Plazo de la vendedora</h2>
    <p>La vendedora cuenta con cinco días naturales desde la confirmación del pago para registrar una guía rastreable. Vencido el plazo, el sistema bloquea el registro tardío, cambia la operación a reembolso pendiente y mantiene el saldo bloqueado.</p>
    <h2>Guía y paquetería</h2>
    <p>Todo envío deberá contar con rastreo, seguro, firma y entrega contra identificación oficial. La vendedora deberá contratar un servicio que permita acreditar la recepción por la compradora o por la persona autorizada en el destino del pedido. La guía debe corresponder a una paquetería reconocida, dirigirse exclusivamente al destino del pedido y mostrar eventos reales. SECOND VOW no conserva copia de la identificación mostrada a la paquetería.</p>
    <h2>Evidencia de la vendedora</h2>
    <p>Antes de registrar la guía, la vendedora debe subir evidencia del estado del vestido, del paquete cerrado y del comprobante de recepción de la paquetería. También se recomienda grabar video continuo del vestido y su empaquetado. Debe conservar los originales hasta que concluya la operación.</p>
    <h2>Recepción y evidencia</h2>
    <p>La compradora debe fotografiar todos los lados del paquete, etiqueta y cualquier alteración antes de abrirlo; grabar video continuo desde el paquete cerrado hasta revisar el vestido; fotografiar inmediatamente vestido, etiquetas, accesorios y diferencias; conservar el empaque durante 48 horas; y no lavar, alterar, reparar ni usar el vestido durante la revisión.</p>
    <p>SECOND VOW registra la entrega cuando recibe un evento <em>delivered</em> del proveedor de rastreo o cuando la compradora confirma manualmente la recepción. El primer registro válido inicia la ventana de 48 horas y conserva separadamente la fecha histórica informada por la paquetería.</p>
    <p>Un estado <em>delivered</em> acredita el evento reportado por la paquetería, pero no prueba por sí solo quién recibió ni el estado interior del vestido. Si la compradora reporta oportunamente que no recibió el paquete, el saldo se bloquea mientras SECOND VOW revisa el rastreo y, cuando esté disponible, la firma, el nombre del receptor y la constancia de entrega.</p>
    <h2>Pago en revisión</h2>
    <p>Si el pago es desconocido, disputado o marcado como riesgoso, la vendedora recibe la instrucción “NO ENVÍES” y el backend bloquea la guía y el retiro. Enviar contra ese bloqueo queda fuera del protocolo de protección.</p>
  </main>;
}
