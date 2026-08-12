# SECOND VOW

**v1.2.5 — 2026-08-12**

- Conserva todos los vestidos existentes y todos sus estados.
- Corrige consultas ambiguas entre `dresses` y `brand_suggestions` en Mis vestidos y Administración.
- Evita mostrar listas vacías cuando Supabase devolvió un error; ahora se muestra el error real.
- Corrige la carga de edición de vestidos con marca sugerida sin usar embeds ambiguos.
- Refuerza Stripe Connect para mostrar el error real y garantizar que el botón deje de quedarse en “Abriendo Stripe…”.
- Mantiene UX-01, Guardados y la ficha administrativa detallada de v1.2.4.
- No modifica migraciones 0011, 0012 ni 0013 y no requiere una migración nueva.
