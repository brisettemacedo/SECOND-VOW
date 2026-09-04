# SECOND VOW v1.8.8 — reducción de Fast Origin Transfer

## Qué cambió

- Las fotografías del catálogo se firman en el servidor por lotes y el navegador las descarga directamente desde Supabase Storage.
- Los borradores, “Mis vestidos” y Administración reciben URLs temporales de una hora; el catálogo público recibe URLs de seis horas.
- La ruta histórica `/api/dress-images/...` ya no descarga ni retransmite archivos. Valida que la publicación sea pública o que quien solicita sea la vendedora/administradora y responde con una redirección temporal a Supabase.
- Las fotos nuevas obtienen una URL firmada al terminar de subir para que la vendedora pueda verlas, seleccionar la principal y eliminarlas sin recargar.
- La galería y todas las tarjetas conservan la selección de miniaturas y la foto principal.

## Decisión sobre Upstash

No se agregaron `@upstash/redis` ni `@upstash/ratelimit`. El ahorro ocurre al dejar de enviar los bytes de cada foto a través de Vercel. Un rate limiter externo no reduce el peso de una imagen legítima, añade otra cuenta y dos secretos y no es necesario para este piloto. La aplicación ya tiene rate limiting en PostgreSQL para las acciones que sí lo necesitan.

## Despliegue

1. Subir esta versión a GitHub y desplegar en Vercel.
2. Confirmar que Vercel conserva `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
3. No hace falta ejecutar una migración nueva ni crear otro bucket.
4. En DevTools → Network, las respuestas finales de las fotos deben apuntar a `*.supabase.co`, no transferir la imagen desde `/api/dress-images/`.
5. Revisar el uso de Fast Origin Transfer durante 24–48 horas. Este cambio reduce consumo futuro; no reinicia el consumo ya acumulado del periodo.
