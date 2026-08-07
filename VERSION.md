# SECOND VOW v1.0

Fecha de consolidación: 2026-08-07

Fuente de frontend: `SECOND-VOW_TALLA_CONTROLADA.zip`.
Migraciones añadidas y consolidadas: `0007`–`0010` V2.

Correcciones adicionales de consolidación:
- catálogos de publicación y filtros cargados desde las tablas normalizadas de `0007`;
- características seleccionables guardadas en `dress_characteristics`;
- descripción libre conservada en `dresses.descripcion`;
- ubicación retirada del catálogo y del formulario de cuenta;
- ofertas adaptadas a RPCs de `0008`;
- pedidos/reclamaciones adaptados a RPCs y plazo de 72 horas de `0009`;
- pantalla de pagos/retiros adaptada al esquema de `0010`;
- ningún SQL anterior se debe volver a ejecutar si ya figura aplicado en Supabase.
