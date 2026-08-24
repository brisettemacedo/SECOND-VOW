import Link from "next/link";
import Image from "next/image";
import SellerRecoveryCalculator from "@/components/SellerRecoveryCalculator";

export const dynamic = "force-dynamic";

const HERO_IMAGES = [
  { src: "/images/hero-1.jpg", alt: "Novia probándose un vestido de novia" },
  { src: "/images/hero-2.jpg", alt: "Detalle de encaje de un vestido de novia" },
  { src: "/images/hero-3.jpg", alt: "Novia con un vestido de cola larga" },
];

const BENEFITS = [
  { icon: "tag", title: "Mejor precio", text: "Encuentra vestidos de diseñador por una fracción de su precio original." },
  { icon: "shield", title: "Identidad verificada y compra segura", text: "Compra a vendedoras con identidad verificada. Tu pago se libera a la vendedora una vez que recibes el vestido y transcurre el periodo de protección." },
  { icon: "online", title: "100% en línea", text: "Compra y vende desde cualquier parte de México. Sin citas, consignaciones ni intermediarios físicos." },
  { icon: "message", title: "Mensajería con la vendedora", text: "Habla en privado con la vendedora, pide medidas, resuelve tus dudas y compra con confianza." },
] as const;

function BenefitIcon({ name }: { name: typeof BENEFITS[number]["icon"] }) {
  if (name === "shield") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "online") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>;
  if (name === "message") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 9h8M8 12h5"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9 8.6-8.6A2 2 0 0 1 13 4h6a1 1 0 0 1 1 1v6a2 2 0 0 1-.4 1.4Z"/><circle cx="16.5" cy="7.5" r="1.4"/></svg>;
}

export default function HomePage() {
  const heroImage = HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];
  return <main className="home-page">
    <section className="home-hero">
      <Image src={heroImage.src} alt={heroImage.alt} fill priority sizes="100vw" className="home-hero-image" />
      <div className="home-hero-overlay" />
      <div className="home-hero-content">
        <p className="home-wordmark">SECOND VOW</p>
        <h1><span>Tu vestido ya tuvo un gran día.</span><span>¡Puede tener otro!</span></h1>
        <p className="home-hero-subtitle">Compra y vende vestidos de novia en México.</p>
        <Link className="btn home-hero-cta" href="/vestidos">Encontrar mi vestido</Link>
      </div>
    </section>

    <section className="home-benefits" aria-label="Beneficios de SECOND VOW">
      {BENEFITS.map((benefit) => <article className="home-benefit" key={benefit.title}>
        <div className="home-benefit-icon"><BenefitIcon name={benefit.icon} /></div>
        <h2>{benefit.title}</h2>
        <p>{benefit.text}</p>
      </article>)}
    </section>

    <section className="home-sell-section">
      <div className="home-section-heading">
        <p className="eyebrow">Vende en SECOND VOW</p>
        <h2>¿Lista para darle una segunda vida a tu vestido?</h2>
        <p>Publicarlo es gratis.</p>
      </div>
      <div className="home-seller-steps">
        <article><span>1</span><h3>Publica gratis</h3><p>Sube tus fotos, medidas y todos los detalles de tu vestido.</p></article>
        <article><span>2</span><h3>Recibe ofertas</h3><p>Recibe ofertas, habla con posibles compradoras, cotiza el envío y realiza la venta directamente en SECOND VOW.</p></article>
        <article><span>3</span><h3>Recibe tu dinero</h3><p>Cuando la operación se completa, SECOND VOW cobra una comisión del <strong>18% del precio de venta</strong> y tú recibes el <strong>82% restante</strong>, sujeto a los términos aplicables.</p></article>
      </div>
      <SellerRecoveryCalculator />
    </section>
  </main>;
}
