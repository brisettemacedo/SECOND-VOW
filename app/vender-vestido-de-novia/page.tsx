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
  ["Crea tu publicación", "Sube fotografías claras e indica marca, talla, medidas, condición, ajustes y cualquier detalle relevante."],
  ["Habla con las interesadas", "Responde preguntas dentro del chat privado y recibe el código postal o destino para cotizar el envío."],
  ["Envía la oferta final", "Separa el precio del vestido y el costo del envío para que la compradora conozca el total antes de pagar."],
  ["Envía y recibe tu saldo", "Después del pago registra una guía con rastreo. SECOND VOW libera el saldo conforme al periodo de protección."],
] as const;

export default function SellWeddingDressPage() {
  return <main className="seo-landing">
    <header className="seo-landing-hero">
      <p className="eyebrow">Vende desde cualquier parte de México</p>
      <h1>¿Dónde vender mi vestido de novia usado?</h1>
      <p>En SECOND VOW puedes publicar gratis tu vestido de novia de segunda mano o nuevo sin usar, hablar directamente con compradoras y recibir el pago dentro de la plataforma.</p>
      <Link className="btn btn-primary" href="/publicar">Publicar mi vestido gratis</Link>
    </header>

    <section aria-labelledby="sell-steps-title">
      <h2 id="sell-steps-title">Cómo vender tu vestido de novia</h2>
      <div className="seo-step-grid">{steps.map(([title, text], index) => <article key={title}><strong>{index + 1}</strong><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </section>

    <section className="seo-trust-copy">
      <h2>Una publicación especializada para tu vestido</h2>
      <p>SECOND VOW está diseñado específicamente para vestidos de novia en México. Las compradoras pueden filtrar por talla, silueta, marca, tela, condición y precio, en lugar de buscar entre miles de productos que no tienen relación.</p>
      <p>Publicar no tiene costo. Cuando se concreta una venta, SECOND VOW retiene una comisión del 18% sobre el total de vestido y envío; la comisión de procesamiento de Stripe está incluida.</p>
      <p>Si todavía no sabes si venderlo, consulta nuestra guía sobre <Link href="/que-hacer-con-mi-vestido-de-novia">qué hacer con tu vestido de novia después de la boda</Link>.</p>
    </section>

    <SellerRecoveryCalculator />

    <section className="seo-faq" aria-labelledby="sell-faq-title">
      <h2 id="sell-faq-title">Preguntas sobre vender un vestido de novia</h2>
      <details><summary>¿Puedo publicar un vestido nuevo?</summary><p>Sí. Puedes publicar vestidos usados y vestidos nuevos que no fueron utilizados, siempre describiendo correctamente su condición.</p></details>
      <details><summary>¿Necesito esperar si mi marca no aparece?</summary><p>No. Puedes terminar la publicación. Mientras revisamos la marca, el vestido se muestra sin marca confirmada y se actualiza cuando la administradora la autoriza.</p></details>
      <details><summary>¿Quién calcula el envío?</summary><p>La vendedora cotiza el envío cuando la compradora comparte en privado su código postal o la sucursal de paquetería elegida.</p></details>
      <details><summary>¿Cuándo recibo mi dinero?</summary><p>El pago permanece protegido durante el envío y el plazo de revisión. Después se habilita el saldo conforme al estado del pedido.</p></details>
    </section>
  </main>;
}
