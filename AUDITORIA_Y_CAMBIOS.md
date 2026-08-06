# Auditoría técnica y cambios aplicados

## Correcciones de compilación y Vercel
- Se separaron `/login` y `/signup` en Server Components y formularios Client Components envueltos en `Suspense`.
- Se marcaron las rutas de autenticación como dinámicas para evitar prerender incorrecto.
- Se centralizó la validación de variables de entorno.
- Se admite `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y, temporalmente, la llave legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Se eliminó el lockfile antiguo para que Vercel resuelva una versión parcheada de Next.js 14.2.x conforme a `package.json`.
- Se añadió `npm run typecheck`.

## Seguridad
- Se impidieron redirecciones externas mediante el parámetro `next`.
- El cliente Supabase de navegador se reutiliza en vez de recrearse en cada render.
- `dress-images` permanece privado.
- Las imágenes se sirven por `/api/dress-images/...`; la ruta usa la sesión y RLS de Supabase.
- Se eliminaron las URLs públicas directas del bucket.
- Se restringieron columnas administrativas de perfiles.
- Se añadieron helpers RLS sin recursión y políticas repetibles.
- Se protegieron transiciones y campos de moderación de vestidos.
- Se validó pertenencia de rutas de Storage y de sugerencias de marca.

## Decisiones de producto incorporadas
- Se eliminó prueba y entrega presencial de interfaz, consultas y esquema nuevo.
- Se conservaron los filtros existentes restantes; no se creó herramienta de compatibilidad.
- El perfil público solo contempla identidad verificada, rango de respuesta y calificación.
- La ubicación y nombre de la cuenta no se muestran en el perfil público.
- Se documentó devolución futura solo por incumplimiento, dentro de 60 días naturales.

## Limitaciones reales de esta entrega
Esta carpeta corrige y estabiliza el alcance existente, pero todavía no convierte SECOND VOW en un marketplace comercial completo. No están desarrollados:
- formulario visual completo de publicación Fase 5;
- mensajería Fase 6;
- panel administrativo;
- ofertas, pedidos y pagos;
- integración de paquetería;
- reclamaciones y devoluciones;
- verificación de identidad real;
- cálculo real de tiempo de respuesta y calificaciones.

Las columnas de reputación añadidas al esquema quedan preparadas para esas fases futuras.

## Validación realizada
- Revisión manual de todos los archivos del ZIP original.
- Revisión cruzada entre consultas del frontend y nombres de tablas/columnas SQL.
- Búsqueda de referencias a entrega/prueba presencial y URLs públicas de Storage.
- Comprobación sintáctica de TypeScript hasta el punto permitido sin descargar dependencias.

No fue posible ejecutar `npm install`/`next build` en el entorno de revisión porque el registro interno de paquetes devolvió 404 para una dependencia. Vercel deberá ejecutar la compilación final con acceso normal a npm. Esto se declara expresamente; no se afirma un build exitoso que no pudo ejecutarse aquí.
