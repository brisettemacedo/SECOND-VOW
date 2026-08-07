-- ============================================================
-- SECOND VOW — 0006 · Talla controlada y operación sin ubicación
-- Ejecutar DESPUÉS de 0001-0005 en el proyecto ya creado.
-- No borra vestidos ni usuarias.
-- ============================================================

begin;

-- La plataforma opera mediante envío; ciudad y estado dejan de ser
-- requisitos para mandar un vestido a revisión.
alter table public.dresses
  drop constraint if exists dresses_completa_antes_de_revision;

alter table public.dresses
  add constraint dresses_completa_antes_de_revision check (
    status in ('draft', 'changes_requested', 'rejected', 'archived')
    or (
      nullif(btrim(talla_etiqueta), '') is not null
      and silueta is not null
      and escote is not null
      and espalda is not null
      and manga is not null
      and tela_principal is not null
      and color_principal is not null
      and cola is not null
      and condicion is not null
      and precio_venta_mxn is not null
      and (brand_id is not null or brand_suggestion_id is not null)
    )
  );

-- El frontend usa exactamente este catálogo. Esta restricción evita
-- variantes manuales como "Talla 8", "8 MX" o "ocho".
alter table public.dresses
  drop constraint if exists dresses_talla_etiqueta_controlada;

alter table public.dresses
  add constraint dresses_talla_etiqueta_controlada check (
    talla_etiqueta is null
    or talla_etiqueta in (
      '0','2','4','6','8','10','12','14','16','18','20','22','24','26','28','30','32',
      'XS','S','M','L','XL','XXL'
    )
  );

-- SECOND VOW no ofrece entrega ni prueba presencial. Todos los vestidos
-- quedan marcados para envío, incluso borradores previos.
update public.dresses
set envio_nacional = true
where envio_nacional is distinct from true;

alter table public.dresses
  drop constraint if exists dresses_envio_obligatorio;

alter table public.dresses
  add constraint dresses_envio_obligatorio
  check (envio_nacional = true);

commit;
