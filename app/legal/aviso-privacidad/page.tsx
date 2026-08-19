import Link from "next/link";
import { LEGAL_ADDRESS, LEGAL_NAME, PRIVACY_EMAIL, PRIVACY_VERSION } from "@/lib/site";

export default function Privacy() {
  return <main className="legal-page">
    <h1>Aviso de Privacidad Integral</h1>
    <p className="legal-meta">Versión {PRIVACY_VERSION}</p>
    <p><strong>{LEGAL_NAME}</strong>, con domicilio en <strong>{LEGAL_ADDRESS}</strong>, es responsable del tratamiento de datos personales recabados mediante SECOND VOW. Contacto de privacidad: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</p>

    <h2>1. Datos tratados</h2>
    <p>Podemos tratar nombre, correo, teléfono y datos de cuenta; perfil y reputación; publicaciones, fotografías, medidas y descripciones; mensajes, ofertas y favoritos; domicilio de envío; pedidos, pagos, comisiones, retiros, facturación, reclamaciones y evidencia; datos de soporte; dirección IP, dispositivo, navegador, registros de acceso, cookies y señales de prevención de fraude.</p>
    <p>La información completa de tarjetas, cuentas bancarias y documentos requeridos para el alta financiera es recopilada directamente por Stripe. SECOND VOW conserva únicamente identificadores técnicos, estado de onboarding, resultado de verificación, banco y últimos cuatro dígitos cuando estén disponibles. SECOND VOW no solicita nuevas copias de INE o pasaporte dentro de su propio almacenamiento.</p>

    <h2>2. Finalidades primarias</h2>
    <p>Crear y administrar cuentas; autenticar usuarias; publicar y moderar vestidos; operar mensajes, ofertas, pedidos, pagos, envíos, saldos y retiros; mostrar reputación limitada; prevenir fraude, falsificación, abuso y evasión de comisiones; atender soporte, reclamaciones, devoluciones y derechos ARCO; conservar evidencia; proteger derechos; cumplir obligaciones contractuales, fiscales, contables y requerimientos de autoridad.</p>

    <h2>3. Finalidades secundarias</h2>
    <p>Con el consentimiento o fundamento aplicable podremos elaborar analítica, mejorar el servicio y enviar promociones. Puedes oponerte a estas finalidades sin perder funciones esenciales.</p>

    <h2>4. Encargados, proveedores y transferencias</h2>
    <p>Podemos utilizar proveedores como Supabase para infraestructura, autenticación y almacenamiento; Stripe para pagos, verificación financiera y dispersión; Ship24 y paqueterías para seguimiento; Vercel para alojamiento; y proveedores de seguridad, soporte, correo o analítica. Cada uno recibe solo los datos necesarios para su función y puede operar infraestructura fuera de México con las salvaguardas aplicables.</p>
    <p>Podremos comunicar datos a compradora, vendedora y proveedores cuando sea necesario para ejecutar la operación solicitada; cumplir obligaciones legales; atender autoridades; prevenir fraude; o ejercer y defender derechos. Cuando una transferencia requiera consentimiento, se solicitará conforme a la ley.</p>

    <h2>5. Conservación</h2>
    <p>La cuenta y datos operativos se conservan mientras exista la relación y posteriormente durante los plazos legales, fiscales, contractuales o de prescripción aplicables. Mensajes, pedidos y evidencia podrán bloquearse mientras sean necesarios para controversias o prevención de fraude. Los documentos manuales de identidad recibidos antes de esta versión se eliminan al resolver la revisión; los pendientes abandonados se eliminan después de 30 días. Los plazos pueden ampliarse cuando exista reclamación, contracargo, investigación o requerimiento de autoridad.</p>

    <h2>6. Seguridad y vulneraciones</h2>
    <p>Aplicamos controles de acceso, registros, separación de credenciales, cifrado en tránsito, almacenamiento privado y minimización. Ningún sistema conectado a internet es infalible. Cuando una vulneración afecte significativamente derechos patrimoniales o morales, se notificará a las personas afectadas conforme a la legislación aplicable, indicando naturaleza, datos comprometidos, recomendaciones, acciones correctivas y medio de contacto.</p>

    <h2>7. Derechos ARCO, revocación y limitación</h2>
    <p>Puedes solicitar Acceso, Rectificación, Cancelación u Oposición; revocar consentimiento o limitar uso y divulgación. La solicitud debe identificar a la titular, señalar un medio de respuesta, describir el derecho y los datos involucrados y, cuando proceda, acreditar identidad o representación. Se responderá dentro de los plazos legales.</p>
    <p>Presenta tu solicitud en <Link href="/cuenta/privacidad">Cuenta → Privacidad y derechos ARCO</Link> o mediante <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</p>

    <h2>8. Cookies</h2>
    <p>Utilizamos cookies necesarias para sesión, seguridad y funcionamiento. Las tecnologías analíticas o promocionales, si se incorporan, se sujetarán a la <Link href="/legal/cookies">Política de Cookies</Link> y al consentimiento requerido.</p>

    <h2>9. Cambios y autoridad</h2>
    <p>Los cambios materiales se publicarán con nueva fecha y, cuando corresponda, se comunicarán por correo o dentro de la plataforma. Si consideras vulnerados tus derechos, puedes acudir ante la autoridad federal competente en protección de datos personales en posesión de particulares.</p>
  </main>;
}
