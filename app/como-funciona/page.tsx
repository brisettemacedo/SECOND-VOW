import Link from "next/link";

const buyerSteps=[
  ["Encuentra tu vestido","Explora el catálogo, guarda tus favoritos y pregunta medidas o detalles directamente a la vendedora."],
  ["Comparte tu destino","En el chat indica de forma privada el domicilio o sucursal donde recibirás y el nombre completo de quien mostrará su identificación."],
  ["Recibe la oferta final","La vendedora cotiza el envío asegurado y te envía una oferta con vestido, envío y total claramente separados."],
  ["Paga y da seguimiento","Acepta la oferta y paga de forma segura con Stripe. Después podrás consultar la guía y el avance desde tu pedido."],
] as const;

const sellerSteps=[
  ["Publica tu vestido","Describe honestamente su estado, medidas y detalles. La publicación permanece activa hasta que se venda o decidas retirarla."],
  ["Conversa en privado","Responde dudas dentro de SECOND VOW. Cuando la compradora comparta su destino, podrás cotizar el envío."],
  ["Envía la oferta final","Indica por separado el precio del vestido y el costo del envío. La compradora verá el total antes de pagar."],
  ["Registra la guía","Después del pago tienes cinco días naturales para enviar con seguro, rastreo, firma y entrega contra identificación."],
] as const;

function StepList({steps}:{steps:typeof buyerSteps|typeof sellerSteps}){
  return <ol className="how-step-grid">{steps.map(([title,description],index)=><li key={title}><span>{index+1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>;
}

export default function How(){return <main className="legal-page how-page">
  <header className="how-intro"><p className="eyebrow">Un proceso claro y acompañado</p><h1>¿Cómo funciona SECOND VOW?</h1><p>Comprar o vender un vestido debe sentirse sencillo. La conversación, la oferta, el pago y el seguimiento permanecen dentro de la plataforma para proteger a ambas partes.</p></header>
  <section><h2>Quiero comprar</h2><StepList steps={buyerSteps}/></section>
  <section><h2>Quiero vender</h2><StepList steps={sellerSteps}/></section>
  <section className="how-protection"><h2>Protección después de la entrega</h2><p>La compradora debe recibir contra identificación y firma. Desde que SECOND VOW registra la entrega cuenta con 48 horas para reportar daños relevantes o información materialmente incorrecta que no hubiera sido declarada.</p><p>No procede una devolución porque el vestido no quede, no guste o exista un cambio de opinión. Ninguna regla interna elimina los derechos irrenunciables que resulten aplicables.</p></section>
  <section className="how-support"><div><p className="eyebrow">Estamos para ayudarte</p><h2>Acompañamiento humano cuando lo necesites</h2><p>Si algo no está claro durante tu publicación o venta, escríbenos. Queremos ayudarte a llegar al siguiente paso con seguridad.</p></div><a className="btn btn-primary" href="mailto:team@auth.second-vow.com">Contactar a SECOND VOW</a></section>
  <div className="actions"><Link className="btn btn-primary" href="/vender">Publicar mi vestido</Link><Link className="btn btn-secondary" href="/vestidos">Ver vestidos</Link></div>
</main>}
