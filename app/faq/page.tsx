import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Preguntas sobre comprar y vender vestidos de novia",
  description: "Resuelve dudas sobre publicar, comprar, pagar, enviar y reclamar vestidos de novia de segunda mano en SECOND VOW México.",
  alternates: { canonical: "/faq" },
};

const questions = [
  ["¿Necesito cuenta para buscar?", "No. Puedes explorar vestidos de novia sin registrarte. Necesitarás una cuenta para guardar favoritos, conversar o comprar."],
  ["¿Publicar cuesta?", "No. Al vender, SECOND VOW retiene 18% del total de la oferta (vestido + envío). La vendedora recibe 82% del total y paga la guía con ese saldo."],
  ["¿Cómo funciona una oferta?", "La compradora pregunta por chat y comparte privadamente su nombre y destino. La vendedora cotiza el envío y manda una oferta final separando vestido y envío. La compradora puede aceptarla y pagar o rechazarla. La oferta vence en 48 horas."],
  ["¿Aceptar reserva el vestido?", "No. El vestido sigue visible. La primera compradora cuyo pago confirme Stripe obtiene el vestido. El pago puede reintentarse dentro del plazo del pedido."],
  ["¿Puedo devolver porque no me quedó?", "No. Solo procede una reclamación por información falsa o materialmente incorrecta, incluido un daño relevante no declarado, dentro de 48 horas desde la entrega, sin perjuicio de derechos irrenunciables aplicables."],
  ["¿Qué ocurre en una controversia?", "La compradora explica el problema y puede adjuntar evidencia. SECOND VOW congela el saldo y avisa a la vendedora, quien puede responder y aportar su evidencia. Después se revisan publicación, mensajes, rastreo y pruebas para emitir una decisión motivada."],
  ["¿Quién paga el envío de regreso?", "Cuando se confirma un incumplimiento atribuible a la vendedora, normalmente se carga a ella el costo comprobable del regreso. En otros casos SECOND VOW determina la responsabilidad según la evidencia, la causa y los derechos aplicables."],
  ["¿Quién envía el vestido?", "La vendedora tiene cinco días naturales desde el pago. Todo envío debe incluir seguro, rastreo, firma y entrega contra identificación oficial. También debe conservar evidencia razonable del vestido, paquete y entrega a paquetería."],
  ["¿La vendedora puede cancelar?", "Puede cancelar una oferta pendiente y una venta antes de enviar. Si ya se pagó, SECOND VOW solicita el reembolso a Stripe."],
] as const;

export default function Faq() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/faq#preguntas`,
    mainEntity: questions.map(([name, text]) => ({
      "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text },
    })),
  };

  return <main className="legal-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <h1>Preguntas frecuentes sobre SECOND VOW</h1>
    <p>Información práctica para comprar y vender vestidos de novia de segunda mano en México.</p>
    {questions.map(([question, answer]) => <section key={question}><h2>{question}</h2><p>{answer}</p></section>)}
  </main>;
}
