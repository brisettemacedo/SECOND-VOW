SECOND VOW — 0007 a 0010 (revisión 2)

IMPORTANTE
- Usa estos archivos SOLO si todavía NO ejecutaste la versión anterior de 0007, 0008, 0009 o 0010.
- Si ya ejecutaste alguno, no lo vuelvas a ejecutar: pide una migración de reparación incremental.
- 0001–0006 permanecen congelados.

ORDEN
1. 0007_catalogos_y_mensajeria.sql
2. 0008_ofertas.sql
3. 0009_pedidos_envios_reclamaciones.sql
4. 0010_pagos_y_retiros_stripe_connect.sql

CAMBIOS CLAVE
- Reclamaciones: solo 72 horas desde la entrega.
- Devolución aprobada: 5 días naturales para entregar a paquetería.
- Catálogos controlados en base de datos para talla, sistema de talla, silueta, escote, espalda, manga, tela, color, cola y condición.
- Índices parciales para catálogo de 50,000+ vestidos.
- Comisión vigente desde 0018: 18% total del precio del vestido, incluyendo el costo ordinario de Stripe; sin cargo fijo. Publicación gratis.
- Envío: la vendedora lo fija en su oferta según el código postal; la comisión del 18% se calcula sobre vestido + envío.
- Stripe Connect: la vendedora no necesita cuenta Stripe previa. Vincula banco mediante onboarding integrado/hosted de Stripe y solicita retiro desde SECOND VOW.
