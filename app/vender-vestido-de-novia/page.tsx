import type { Metadata } from "next";
import Link from "next/link";
import SellerRecoveryCalculator from "@/components/SellerRecoveryCalculator";

export const metadata: Metadata = {
  title: "Dónde vender mi vestido de novia usado en México",
  description: "Vende tu vestido de novia usado en México. Publica gratis en SECOND VOW, conversa con compradoras, recibe ofertas y cobra dentro de la plataforma.",
  alternates: { canonical: "/vender-vestido-de-novia" },
  openGraph: {
    title: "Vende tu vestido de novia en México",
    description: "Publica gratis, conversa con compradoras y vende tu vestido dentro de SECOND VOW.",
    url: "/vender-vestido-de-novia",
    images: ["/images/how-it-works-chat.webp"],
  },
};

const steps = [
  ["Publica gratis", "Sube fotos, talla, medidas y detalles del vestido."],
  ["Habla con la compradora", "Responde sus dudas por mensaje y acuerden el precio."],
  ["Envía una oferta", "Cotiza el envío y muestra el total antes del pago."],
  ["Envía y cobra", "Registra la guía. Recibirás tu dinero después del plazo de protección."],
] as const;

export default function SellWeddingDressPage() {
  return <main className="seo-landing">
    <header className="seo-landing-hero">
      <p className="eyebrow">Vende en SECOND VOW</p>
      <h1>Vende tu vestido de novia</h1>
      <p>Publícalo gratis, habla con compradoras y recibe tu pago en SECOND VOW.</p>
      <Link className="btn btn-primary" href="/publicar">Publicar mi vestido gratis</Link>
    </header>

    <section aria-labelledby="sell-steps-title">
      <h2 id="sell-steps-title">Así funciona</h2>
      <div className="seo-step-grid">{steps.map(([title, text], index) => <article key={title}><strong>{index + 1}</strong><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </section>

    <section className="seo-trust-copy">
      <h2>Publicar es gratis</h2>
      <p>Si vendes tu vestido, SECOND VOW retiene el 18% del total, incluido el envío. La comisión de procesamiento ya está incluida.</p>
      <p>¿Aún no decides qué hacer con él? <Link href="/que-hacer-con-mi-vestido-de-novia">Lee esta guía</Link>.</p>
    </section>

    <SellerRecoveryCalculator />

    <section className="seo-faq" aria-labelledby="sell-faq-title">
      <h2 id="sell-faq-title">Preguntas frecuentes</h2>
      <details><summary>¿Puedo publicar un vestido nuevo?</summary><p>Sí, si no se usó. Indica su condición real.</p></details>
      <details><summary>¿Y si mi marca no aparece?</summary><p>Puedes publicar. La revisaremos y la añadiremos después.</p></details>
      <details><summary>¿Quién cotiza el envío?</summary><p>Tú, cuando la compradora te comparta su destino por mensaje.</p></details>
      <details><summary>¿Cuándo recibo mi dinero?</summary><p>Después de la entrega y del plazo de protección, si no hay reclamaciones.</p></details>
    </section>
  </main>;
}
