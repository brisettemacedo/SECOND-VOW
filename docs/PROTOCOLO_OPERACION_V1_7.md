# Protocolo operativo SECOND VOW 1.7

## Configuración indispensable

1. Aplicar `0019_flujo_integral_48h_contracargos_devoluciones.sql` después de `0018`.
2. Configurar en Stripe el webhook `/api/stripe/webhook` con Checkout, pagos, reembolsos, cuentas Connect, transferencias, payouts, `charge.dispute.*`, `radar.early_fraud_warning.created` y `review.*`.
3. Configurar `/api/ship24/webhook` y su secreto. Ship24 debe enviar `delivered`; SECOND VOW conserva tanto la fecha histórica del transportista como la recepción del webhook.
4. Configurar `CRON_SECRET`. Vercel Hobby ejecuta un único cierre diario. Los bloqueos críticos también operan por webhook y por las RPC del servidor; no dependen del navegador.
5. Completar nombre legal, domicilio, teléfono y correos en las variables públicas antes del lanzamiento.

## Flujo compradora

- Acepta condiciones específicas, reconoce el descriptor del cargo, importe, vestido y domicilio.
- Stripe confirma el cobro; una pantalla de regreso no sustituye al webhook.
- Puede confirmar entrega manualmente. El primer registro válido abre 48 horas.
- Solo puede reclamar información falsa o materialmente incorrecta, incluido daño relevante no informado. No procede porque no le quede.
- Una devolución aprobada requiere guía rastreable. Ship24 puede acreditar su recepción.

## Flujo vendedora

- Stripe Connect debe estar verificado antes de aceptar cobros.
- Tras el pago tiene cinco días naturales para registrar guía.
- Si aparece `payment_review`, `chargeback_open` o `shipping_blocked_at`, no puede registrar envío.
- Desde $10,000 MXN debe confirmar seguro y firma; debajo son recomendables.
- Al terminar 48 horas sin reclamación ni alerta, el saldo pasa de `held` a `releasable`. El retiro vuelve a validar cuenta, pedido, reclamaciones y contracargos.

## Falta de envío

- Al vencer: bloqueo de guía, `refund_pending`, payout bloqueado y avisos.
- El proceso diario solicita el reembolso completo a Stripe con clave idempotente.
- El webhook de Stripe confirma `refunded`; solo entonces el vestido vuelve a publicarse.
- Si existe contracargo abierto, no se emite un reembolso separado para evitar doble devolución.

## Contracargos

- Alertas tempranas, revisión Radar y disputas bloquean inmediatamente envío y retiro.
- La vendedora recibe “NO ENVÍES”.
- Si ya se envió, se conserva seguimiento y se intenta interceptación fuera de la plataforma cuando la paquetería la permita.
- Debe aportarse a Stripe: Radar/3DS/CVC/AVS, aceptación, descriptor, snapshot, mensajes, domicilio, guía, entrega, firma, seguro y confirmación de la compradora.
- Una disputa ganada restablece el flujo y concede nuevo plazo de envío cuando aún no salió. Una disputa perdida mantiene bloqueado el payout y requiere resolución del caso.

## Evidencia

- Al confirmarse el pago se genera `transaction_snapshots` con pedido, publicación, fotografías, declaración, domicilio y huella SHA-256.
- Mensajes, eventos, seguimiento y evidencias posteriores permanecen asociados al pedido y no tienen permisos ordinarios de edición o eliminación.
- Los objetos de Storage nunca se eliminan directamente por SQL. Si fuera necesario depurar un archivo, se utiliza la Storage API y una bitácora administrativa.

## Límites que deben comunicarse

- SECOND VOW es intermediaria tecnológica, no transportista ni propietaria del vestido.
- Ship24 acredita eventos recibidos, no garantiza por sí mismo el contenido del paquete.
- La aceptación automática cierra el mecanismo interno ordinario, pero no elimina derechos bancarios o legales irrenunciables.
- El saldo `held` es contabilidad interna sobre fondos procesados por Stripe; no es un fideicomiso ni una cuenta escrow legalmente segregada.
