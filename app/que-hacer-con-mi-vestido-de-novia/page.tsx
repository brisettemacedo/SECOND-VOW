import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Qué hacer con mi vestido de novia después de la boda",
  description: "¿Tu vestido de novia sigue guardado? Conoce cómo prepararlo, ponerle precio y venderlo en línea en México para darle una segunda vida.",
  alternates: { canonical: "/que-hacer-con-mi-vestido-de-novia" },
  openGraph: {
    title: "¿Qué hacer con tu vestido de novia después de la boda?",
    description: "Guárdalo, transfórmalo, dónalo o véndelo. Si quieres recuperar parte de tu inversión, publícalo gratis en SECOND VOW.",
    url: "/que-hacer-con-mi-vestido-de-novia",
    images: ["/images/hero-4.webp"],
  },
};

export default function AfterWeddingDressPage() {
  return <main className="seo-article">
    <header>
      <p className="eyebrow">Después del gran día</p>
      <h1>¿Qué hacer con tu vestido de novia después de la boda?</h1>
      <p>Si lleva meses —o años— ocupando medio clóset como una reina jubilada, tienes varias opciones. Venderlo puede ayudarte a recuperar parte de lo que invertiste y permitir que otra mujer encuentre el vestido que estaba buscando.</p>
    </header>
    <section><h2>1. Revisa su estado antes de guardarlo o venderlo</h2><p>Observa el dobladillo, forro, encaje, cierre, botones y aplicaciones. Anota manchas, jalones, reparaciones y ajustes. Una descripción honesta genera confianza y evita problemas durante la venta.</p></section>
    <section><h2>2. Conserva fotografías del día de la boda</h2><p>Las fotos profesionales ayudan a mostrar cómo cae el vestido puesto. Complétalas con imágenes actuales, de frente, espalda, etiqueta, detalles y cualquier imperfección. La compradora necesita ver el vestido real, no imaginarlo con poderes psíquicos.</p></section>
    <section><h2>3. Decide si quieres conservarlo, transformarlo, donarlo o venderlo</h2><p>Conservarlo tiene valor sentimental; transformarlo permite volver a usar parte de la tela; donarlo puede ayudar a otra persona. Si prefieres recuperar parte de la inversión, puedes publicarlo como vestido de novia de segunda mano.</p></section>
    <section><h2>4. Pon un precio realista</h2><p>Considera marca, precio original, antigüedad, condición, limpieza, ajustes y demanda. Los vestidos con medidas completas, fotografías claras y un precio razonable suelen resultar más fáciles de evaluar para una compradora.</p></section>
    <section><h2>5. Véndelo en una plataforma especializada</h2><p>SECOND VOW es un marketplace mexicano dedicado a vestidos de novia usados y nuevos sin usar. Crear una publicación es gratis; puedes conversar con las interesadas, acordar el precio, cotizar el envío y recibir el pago dentro de la plataforma.</p></section>
    <aside className="seo-article-cta">
      <h2>Tu vestido puede encontrar a su próxima novia</h2>
      <p>Sube fotografías, medidas, condición y precio. Si tu marca todavía no aparece en el catálogo, puedes continuar y publicarlo mientras la revisamos.</p>
      <Link className="btn btn-primary" href="/publicar">Publicar mi vestido gratis</Link>
    </aside>
  </main>;
}
