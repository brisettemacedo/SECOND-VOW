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
    <h2>Prueba y decisión</h2>
    <p>La compradora debe describir concretamente lo ocurrido y aportar la evidencia disponible. SECOND VOW puede contrastarla con la copia inalterable de la publicación, fotografías, mensajes, empaque, guía, seguimiento y constancia de entrega. La apertura de una reclamación no implica su aprobación automática.</p>
    <h2>Devolución autorizada</h2>
    <p>Solo cuando exista un vestido recibido y SECOND VOW autorice la devolución, la compradora debe subir una guía rastreable y entregarlo a paquetería dentro del plazo comunicado. El seguimiento de retorno puede acreditar la recepción aunque la vendedora no la confirme manualmente. El vestido debe conservar el estado recibido, salvo el defecto reclamado.</p>
    <h2>Costos</h2>
    <p>Cuando la devolución derive de información falsa o incumplimiento de la vendedora, podrá atribuírsele el costo real y comprobable de la guía de retorno y, únicamente si fue informado antes de contratar, un costo logístico razonable. No se aplican multas automáticas. Escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
  </main>;
}
