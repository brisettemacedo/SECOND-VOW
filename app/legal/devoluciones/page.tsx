import { CONTACT_EMAIL, TERMS_VERSION } from "@/lib/site";

export default function ReturnsPolicy() {
  return <main className="legal-page">
    <h1>Política de reclamaciones y devoluciones</h1>
    <p className="legal-meta">Versión {TERMS_VERSION}</p>
    <h2>Causas cubiertas</h2>
    <p>La compradora puede reclamar cuando el seguimiento indique entrega pero no haya recibido el paquete, o cuando la publicación contenga <strong>información falsa o materialmente incorrecta</strong>, incluido un <strong>daño relevante no informado</strong>, y esa diferencia afecte sustancialmente la identidad, autenticidad, condición, medidas objetivas, modificaciones o componentes anunciados del vestido.</p>
    <h2>Supuestos no cubiertos</h2>
    <p>No procede porque el vestido no quede, no favorezca, la talla elegida resulte inadecuada, exista cambio de opinión, se encuentre otra opción o haya diferencias meramente subjetivas que no contradigan materialmente la publicación.</p>
    <h2>Plazo</h2>
    <p>La compradora dispone de 48 horas contadas desde que SECOND VOW recibe y registra por primera vez una confirmación válida de entrega, ya sea mediante el proveedor de seguimiento o mediante confirmación manual de la compradora. La fecha histórica de la paquetería se conserva como evidencia, pero no reduce retroactivamente el plazo. Si no se abre reclamación dentro de esas 48 horas, opera la aceptación automática interna.</p>
    <h2>Paquete reportado como entregado pero no recibido</h2>
    <p>Si la paquetería reporta entrega y la compradora manifiesta oportunamente que no recibió el paquete, SECOND VOW bloqueará el saldo mientras revisa el rastreo y, cuando esté disponible, la firma, el nombre del receptor y la constancia de entrega. El evento de rastreo no resuelve por sí solo la controversia.</p>
    <h2>Prueba, réplica y decisión</h2>
    <p>La compradora debe describir concretamente lo ocurrido y puede aportar fotografías, video u otra evidencia si la tiene. La carga de archivos no es obligatoria para abrir el expediente, aunque su ausencia puede dificultar acreditar hechos que no consten por otros medios. SECOND VOW puede contrastar lo aportado con la copia inalterable de la publicación, mensajes, empaque, guía, seguimiento y constancia de entrega. La apertura de una reclamación no implica su aprobación automática.</p>
    <p>SECOND VOW notificará a la vendedora, quien tendrá tres días naturales para responder y podrá aportar evidencia. El saldo permanecerá congelado. Una vez recibida la respuesta o vencido el plazo, la resolución identificará el supuesto aplicado —vendedora, compradora, paquetería, plataforma, responsabilidad compartida o falta de acreditación— y explicará su motivo. Cualquiera de las partes podrá solicitar revisión dentro de los tres días naturales siguientes. Una revisión abierta bloquea el reembolso administrativo hasta emitirse una decisión final.</p>
    <h2>Devolución autorizada</h2>
    <p>Solo cuando exista un vestido recibido y SECOND VOW autorice la devolución podrá iniciarse el retorno. Si la decisión atribuye el incumplimiento a la vendedora, ella deberá contratar, pagar y compartir una guía prepagada dentro del plazo comunicado; la compradora no deberá adelantar ese gasto. La compradora usará esa guía y confirmará la entrega a paquetería. En otros supuestos, la decisión indicará quién asume el costo. El seguimiento puede acreditar la recepción aunque la vendedora no la confirme manualmente. El vestido debe conservar el estado recibido, salvo el defecto reclamado.</p>
    <h2>Costos</h2>
    <p>Si la decisión motivada confirma un incumplimiento atribuible a la vendedora, la compradora recibirá el reembolso aprobado al medio de pago original, la vendedora no recibirá el producto de la venta y deberá cubrir directamente la guía prepagada de retorno. Cuando la versión aceptada para la operación lo contemple, podrá registrarse además un cargo por incumplimiento equivalente al 18% del monto efectivamente reembolsado, vestido y envío incluidos. Este cargo sustituye la comisión ordinaria de la misma operación y no se duplica.</p>
    <p>El adeudo se compensa únicamente con saldos futuros y no autoriza débitos automáticos a tarjetas o bancos. No aplica si la reclamación se rechaza, responde a talla o cambio de opinión, deriva de un domicilio erróneo o alteración atribuible a la compradora, corresponde exclusivamente a la paquetería tras un envío correctamente asegurado y documentado, proviene de una cancelación mutua sin incumplimiento o es causada por SECOND VOW o el procesador. Escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    <h2>Paquetería y seguro primero</h2>
    <p>Cuando el hecho corresponda a pérdida o daño en tránsito, SECOND VOW podrá exigir que se inicie primero la reclamación del seguro de envío. El saldo seguirá retenido mientras se obtiene la respuesta de la paquetería. Esta gestión no reduce derechos irrenunciables ni impide una decisión distinta si la evidencia demuestra embalaje insuficiente, información falsa u otro incumplimiento de la vendedora.</p>
  </main>;
}
