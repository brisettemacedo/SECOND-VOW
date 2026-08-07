# SECOND VOW — decisión de pagos y operación (revisión 2)

## Política comercial propuesta

- Publicación de vestido: gratis.
- Comisión de éxito a la vendedora: 15% del precio del vestido.
- Cargo administrativo fijo: $19 MXN por venta completada.
- Sin tarifa de protección a la compradora al lanzamiento.
- Envío: pagado por la compradora, organizado por la vendedora con la paquetería de su elección.
- La vendedora registra el monto del envío antes del checkout y, una vez enviado, carga paquetería y número de guía.
- La comisión porcentual no se calcula sobre el envío.
- Reclamación por incumplimiento: 72 horas desde entrega.
- Si se autoriza devolución: 5 días naturales para entregarla a paquetería.

## Stripe sin obligar a la vendedora a "tener Stripe"

La usuaria no crea una suscripción ni necesita una cuenta Stripe previa. SECOND VOW crea técnicamente una Connected Account y muestra un onboarding alojado o embebido de Stripe para recopilar la información de identidad y la cuenta bancaria. Stripe tokeniza esos datos; SECOND VOW conserva únicamente IDs, estado de verificación y, opcionalmente, banco/últimos 4 dígitos.

La experiencia puede ser: Cuenta > Pagos > Vincular cuenta bancaria. Tras las 72 horas sin reclamación, la venta pasa a saldo disponible. La vendedora pulsa Retirar saldo. El backend solicita el payout a Stripe y Stripe deposita a su banco.

## Modelo Stripe recomendado para validar con Stripe México antes de producción

Direct charges en Connected Accounts + application fee de SECOND VOW + payout manual. Este diseño acerca el flujo a una intermediación: el cargo pertenece a la cuenta conectada de la vendedora, SECOND VOW cobra su application fee y controla cuándo se realiza el payout bancario. La configuración exacta de merchant of record, responsabilidad de disputas, impuestos y tarifas debe confirmarse con Stripe México y con asesoría fiscal antes del lanzamiento.

## Envío

MVP recomendado: seller-arranged. SECOND VOW no necesita integrar Estafeta/DHL en la primera versión. La vendedora cotiza el envío, la compradora lo paga dentro del mismo checkout, la vendedora compra la guía y registra el tracking. El envío debe ser rastreable; para vestidos de alto valor conviene exigir seguro y firma a entrega.
