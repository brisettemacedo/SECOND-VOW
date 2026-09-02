# SECOND VOW v1.8.4

## Hotfix posterior al despliegue

- Se desambiguaron las relaciones PostgREST `dresses → brand_suggestions` en catálogo, ficha, similares y favoritos.
- Se desambiguó `dresses → orders` en “Mis vestidos” después de incorporar `winning_order_id`.
- Este hotfix no requiere una migración adicional: basta desplegar el código actualizado después de haber ejecutado 0024 y 0025.

## Aplicación en una instalación existente

1. Haz respaldo de la base de datos.
2. Confirma que las migraciones `0022` y `0023` ya fueron aplicadas.
3. Ejecuta, en orden y una sola vez, `supabase/migrations/0024_experiencia_unificada_admin.sql` y `supabase/migrations/0025_auditoria_experiencia_hobby.sql` en Supabase SQL Editor.
4. Sustituye el código del repositorio por esta versión, conserva `.git` y tus secretos, y haz push.
5. En Vercel comprueba `NEXT_PUBLIC_SITE_URL=https://second-vow.com` y las demás variables de `.env.example`.
6. Verifica en Stripe que el webhook de producción apunte a `/api/stripe/webhook`.

## Vercel Hobby

`vercel.json` conserva dos tareas distintas, cada una una vez al día, formato admitido por Hobby. La bandeja de Administración detecta pedidos vencidos aunque el cron diario todavía no haya pasado. No cambies una misma tarea a una frecuencia de varias veces al día en Hobby porque Vercel puede rechazar el deployment.

## Pruebas después del despliegue

- Abrir un vestido con varias fotos y cambiar la imagen principal desde cada miniatura.
- Escribir en un borrador, esperar más de 800 ms, recargar y confirmar el autoguardado.
- Editar una publicación ya visible, esperar más de 800 ms y confirmar que se guardó sin dejar de estar publicada. Repetir con un Checkout en proceso y confirmar que la edición quede bloqueada.
- Publicar con marca pendiente y confirmar que siga visible como “marca en confirmación”.
- Aceptar dos ofertas del mismo vestido; ambas pueden cotizar envío y pagar hasta que una complete el cobro.
- Confirmar que el primer pago cambia el vestido a `sold`, cierra los demás pedidos y expira sus sesiones.
- Revisar pestañas y textos en Pedidos, tarjeta superior en Mensajes y bandeja única en Administración.
- Enviar desde la ficha administrativa una sugerencia de mejora y verla en “Mis vestidos”.
- Eliminar una publicación propia; si tuvo pedidos, debe desaparecer de la cuenta y conservar únicamente el historial transaccional.
