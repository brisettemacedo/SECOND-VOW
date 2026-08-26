-- SECOND VOW 0021 — desbloqueo seguro de checkout y cancelación
-- Ejecutar una sola vez después de 0020.
--
-- El trigger heredado orders_enforce_update inspeccionaba auth.uid() incluso
-- cuando el cambio provenía de una RPC SECURITY DEFINER. Eso bloqueaba las
-- operaciones legítimas accept_order_checkout_terms y
-- seller_request_order_cancellation. Desde 0009 el rol authenticated no tiene
-- UPDATE directo sobre orders; todas las mutaciones se realizan mediante RPC
-- específicas que validan participante, estado y columnas permitidas.
begin;

drop trigger if exists orders_enforce_update on public.orders;

-- Defensa en profundidad: ninguna usuaria puede editar orders directamente.
-- Las políticas SELECT permanecen intactas y las RPC autorizadas siguen siendo
-- la única vía de escritura.
revoke update on public.orders from anon, authenticated;

-- Evita que una instalación futura recree accidentalmente el trigger llamando
-- a la función histórica. La función ya no es necesaria ni se expone.
revoke all on function public.enforce_order_update() from public;

commit;
