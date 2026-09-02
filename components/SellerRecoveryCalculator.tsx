"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const COMMISSION_RATE = 0.18;
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export default function SellerRecoveryCalculator() {
  const [originalPrice, setOriginalPrice] = useState(20000);
  const [discount, setDiscount] = useState(30);
  const [shipping, setShipping] = useState(500);
  const result = useMemo(() => {
    const safeOriginal = Number.isFinite(originalPrice) ? Math.max(0, originalPrice) : 0;
    const salePrice = Math.round(safeOriginal * (1 - discount / 100));
    const total = salePrice + Math.max(0, shipping);
    const commission = Math.round(total * COMMISSION_RATE);
    return { salePrice, total, commission, sellerReceives: total - commission };
  }, [originalPrice, discount, shipping]);

  return <div className="recovery-calculator">
    <div className="recovery-calculator-intro">
      <p className="eyebrow">Calcula tu venta</p>
      <h2>¿Cuánto podrías recuperar por tu vestido?</h2>
      <p>Prueba distintos precios para estimar cuánto recibirías después de la comisión.</p>
    </div>
    <div className="recovery-calculator-grid">
      <div className="recovery-controls">
        <label htmlFor="original-price">Precio original</label>
        <div className="money-input"><span>$</span><input id="original-price" type="number" min="0" step="500" inputMode="numeric" value={originalPrice} onChange={(event) => setOriginalPrice(Math.max(0, Number(event.target.value) || 0))} /><span>MXN</span></div>
        <div className="discount-heading"><label htmlFor="discount">Descuento sugerido</label><strong>{discount}%</strong></div>
        <input id="discount" className="discount-slider" type="range" min="10" max="70" step="5" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
        <div className="slider-labels"><span>10%</span><span>70%</span></div>
        <label htmlFor="shipping">Envío que incluirás en la oferta</label>
        <div className="money-input"><span>$</span><input id="shipping" type="number" min="0" step="50" inputMode="numeric" value={shipping} onChange={(event) => setShipping(Math.max(0, Number(event.target.value) || 0))} /><span>MXN</span></div>
      </div>
      <div className="recovery-results" aria-live="polite">
        <div><span>Precio de venta</span><strong>{money.format(result.salePrice)}</strong></div>
        <div><span>Total con envío</span><strong>{money.format(result.total)}</strong></div>
        <div><span>SECOND VOW (18% del total)</span><strong>− {money.format(result.commission)}</strong></div>
        <div className="recovery-total"><span>Recibes</span><strong>{money.format(result.sellerReceives)}</strong></div>
        <small>Tu saldo incluye el dinero para pagar la guía. La comisión se calcula sobre vestido + envío.</small>
      </div>
    </div>
    <p className="recovery-note">Como punto de partida, puedes considerar publicarlo aproximadamente 30% debajo de su precio original. El precio ideal dependerá de la marca, antigüedad, condición y modificaciones.</p>
    <Link className="btn btn-primary" href="/publicar">Vender mi vestido</Link>
  </div>;
}
