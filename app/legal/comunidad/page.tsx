import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import { OFF_PLATFORM_MESSAGE } from "@/lib/contentModeration";

export default function CommunityRules() {
  return <main className="legal-page">
    <p className="eyebrow">Seguridad y convivencia</p>
    <h1>Normas de la comunidad</h1>
    <p>Estas reglas protegen a compradoras y vendedoras, conservan la evidencia de cada operación y ayudan a que SECOND VOW siga siendo un espacio seguro.</p>

    <h2>1. Mantén la operación dentro de SECOND VOW</h2>
    <p>No publiques ni solicites teléfonos, correos, usuarios de redes sociales, enlaces externos, datos bancarios, CLABE o instrucciones de pago por fuera. Tampoco invites a continuar la conversación, negociar, pagar, entregar o enviar el vestido fuera de la plataforma.</p>
    <p>Los datos necesarios para cotizar y completar el envío deben registrarse exclusivamente en el formulario privado de destino. No los escribas en el chat, una oferta o una calificación.</p>
    <div className="alert-error moderation-copy" role="note">{OFF_PLATFORM_MESSAGE}</div>

    <h2>2. Contenido que no está permitido</h2>
    <ul>
      <li>Spam, mensajes repetitivos, publicidad o promoción de otros negocios y plataformas.</li>
      <li>Fraude, suplantación de identidad, phishing, enlaces maliciosos o evidencia manipulada.</li>
      <li>Descripciones engañosas, ocultamiento de daños, falsificaciones o precios manipulados.</li>
      <li>Acoso, amenazas, insultos, discriminación o contenido sexual explícito.</li>
      <li>Presión para reunirse, pagar, enviar o cerrar un trato fuera de SECOND VOW.</li>
    </ul>

    <h2>3. Lo que sí puedes conversar</h2>
    <p>Puedes preguntar por medidas, condición, modificaciones, accesorios, detalles visibles, disponibilidad, precio y envío. La compradora puede proponer un precio en el chat y la vendedora debe emitir la oferta final dentro de SECOND VOW.</p>

    <h2>4. Moderación y consecuencias</h2>
    <p>Usamos controles automáticos y revisión humana para prevenir conductas de riesgo. Un mensaje puede no enviarse si parece contener información prohibida. Según la gravedad o reincidencia, SECOND VOW puede advertir, limitar mensajes, ocultar contenido, cancelar operaciones, suspender o cerrar una cuenta. Las decisiones pueden revisarse cuando exista contexto o evidencia adicional.</p>

    <h2>5. Reportes</h2>
    <p>Si recibes una solicitud para salir de la plataforma, no compartas datos ni realices pagos. Conserva la conversación y repórtala desde SECOND VOW o escribe a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Consulta también los <Link href="/legal/terminos">Términos y Condiciones</Link>.</p>
  </main>;
}
