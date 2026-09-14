"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const COMMISSION_RATE = 0.18;
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export default function SellerRecoveryCalculator() {
  const [originalPrice, setOriginalPrice] = useState(20000);
  const [discount, setDiscount] = useState(30);
  const result = useMemo(() => {
    const safeOriginal = Number.isFinite(originalPrice) ? Math.max(0, originalPrice) : 0;
    const salePrice = Math.round(safeOriginal * (1 - discount / 100));
    const commission = Math.round(salePrice * COMMISSION_RATE);
    return { salePrice, commission, sellerReceives: salePrice - commission };
  }, [originalPrice, discount]);

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
        <div className="shipping-to-define"><strong>Envío por definir</strong><span>Se cotiza cuando una compradora comparta su código postal o sucursal de entrega.</span></div>
      </div>
      <div className="recovery-results" aria-live="polite">
        <div><span>Precio estimado de venta</span><strong>{money.format(result.salePrice)}</strong></div>
        <div><span>Envío</span><strong>Por definir</strong></div>
        <div><span>SECOND VOW (18% estimado)</span><strong>− {money.format(result.commission)}</strong></div>
        <div className="recovery-total"><span>Recibirías por el vestido</span><strong>{money.format(result.sellerReceives)}</strong></div>
        <small>Estimación sin envío. En la oferta final, la comisión se calcula sobre vestido + envío.</small>
      </div>
    </div>
    <p className="recovery-note">Este cálculo es orientativo y no constituye una promesa de venta. El precio ideal dependerá de la marca, antigüedad, condición y modificaciones. El envío se integra después, según el destino de la compradora.</p>
    <Link className="btn btn-primary" href="/publicar">Vender mi vestido</Link>
  </div>;
}
