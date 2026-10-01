begin;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare b public.orders; v_offer uuid:=gen_random_uuid(); origin uuid:=gen_random_uuid(); next_order uuid:=gen_random_uuid(); prior_order uuid:=gen_random_uuid(); small_order uuid:=gen_random_uuid(); final_order uuid:=gen_random_uuid(); legacy_order uuid:=gen_random_uuid(); shipping_order uuid:=gen_random_uuid(); p uuid; v integer; n integer; e text;
begin
 select * into b from public.orders where status='paid' order by created_at desc limit 1;
 if b.id is null then raise exception 'Falta pedido de referencia para prueba'; end if;
 insert into public.offers(id,dress_id,buyer_id,seller_id,amount_mxn,shipping_mxn,status,seller_terms_version,seller_terms_accepted_at)
 values(v_offer,b.dress_id,b.buyer_id,b.seller_id,1000,100,'accepted','2026-09-30.1',now());
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,offer_id,amount_charged_mxn,shipping_block_reason,shipping_blocked_at)
 values(origin,b.dress_id,b.buyer_id,b.seller_id,1000,100,1100,198,902,'refund_pending',v_offer,1100,'shipping_deadline_expired',now());
 insert into public.seller_payouts(order_id,seller_id,amount_mxn) values(origin,b.seller_id,902);
 perform public.backend_record_refund(origin,'test_'||origin::text,1100,'processing','order_cancelled');
 if exists(select 1 from public.seller_debts where order_id=origin) then raise exception 'Cargo anticipado antes de confirmar reembolso'; end if;
 perform public.backend_record_refund(origin,'test_'||origin::text,1100,'succeeded','order_cancelled');
 perform public.backend_record_refund(origin,'test_'||origin::text,1100,'succeeded','order_cancelled');
 select count(*),max(original_amount_mxn) into n,v from public.seller_debts where order_id=origin;
 if n<>1 or v<>44 then raise exception 'Cargo incorrecto o duplicado: %, %',n,v; end if;
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,completed_at)
 values(prior_order,b.dress_id,b.buyer_id,b.seller_id,1000,100,1100,198,902,'completed',now()-interval '1 day');
 insert into public.seller_payouts(order_id,seller_id,amount_mxn) values(prior_order,b.seller_id,902);
 update public.seller_payouts set status='releasable' where order_id=prior_order;
 select debt_offset_mxn into v from public.seller_payouts where order_id=prior_order;
 if v<>0 then raise exception 'Se descontó cargo a venta anterior'; end if;
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,completed_at)
 values(next_order,b.dress_id,b.buyer_id,b.seller_id,1000,100,1100,198,902,'completed',now()+interval '1 second');
 insert into public.seller_payouts(order_id,seller_id,amount_mxn) values(next_order,b.seller_id,902);
 update public.seller_payouts set status='releasable' where order_id=next_order;
 update public.seller_payouts set status='releasable' where order_id=next_order;
 select transfer_amount_mxn into v from public.seller_payouts where order_id=next_order;
 if v<>858 then raise exception 'Descuento incorrecto o duplicado, saldo %',v; end if;
 update public.seller_payouts set status='reversed' where order_id=next_order;
 select recovered_amount_mxn into v from public.seller_debts where order_id=origin;
 if v<>0 then raise exception 'No se restauró adeudo al revertir saldo'; end if;
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,completed_at)
 values(small_order,b.dress_id,b.buyer_id,b.seller_id,25,0,25,5,20,'completed',now()+interval '2 seconds');
 insert into public.seller_payouts(order_id,seller_id,amount_mxn) values(small_order,b.seller_id,20);
 update public.seller_payouts set status='releasable' where order_id=small_order;
 select transfer_amount_mxn into v from public.seller_payouts where order_id=small_order;
 if v<>0 then raise exception 'Saldo insuficiente no limitado'; end if;
 select recovered_amount_mxn into v from public.seller_debts where order_id=origin;
 if v<>20 then raise exception 'Recuperación parcial incorrecta'; end if;
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,completed_at)
 values(final_order,b.dress_id,b.buyer_id,b.seller_id,1000,100,1100,198,902,'completed',now()+interval '3 seconds');
 insert into public.seller_payouts(order_id,seller_id,amount_mxn) values(final_order,b.seller_id,902);
 update public.seller_payouts set status='releasable' where order_id=final_order;
 select transfer_amount_mxn into v from public.seller_payouts where order_id=final_order;
 if v<>878 then raise exception 'Remanente incorrecto: %',v; end if;
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,amount_charged_mxn,shipping_block_reason,shipping_blocked_at)
 values(legacy_order,b.dress_id,b.buyer_id,b.seller_id,1000,100,1100,198,902,'refund_pending',1100,'shipping_deadline_expired',now());
 perform public.backend_record_refund(legacy_order,'test_'||legacy_order::text,1100,'succeeded','order_cancelled');
 if exists(select 1 from public.seller_debts where order_id=legacy_order) then raise exception 'Se aplicó cargo retroactivo'; end if;
 insert into public.orders(id,dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,seller_ship_by)
 values(shipping_order,b.dress_id,b.buyer_id,b.seller_id,1000,100,1100,198,902,'paid',now()+interval '5 days');
 perform set_config('request.jwt.claim.sub',b.seller_id::text,true);
 begin
  perform public.mark_order_shipped_v2(shipping_order,'TEST','TEST',true,false,'2026-09-30.1','6cc8bb0911fad410649ff35e66bfb128451141e864ffe915a711d52ef7672936');
  raise exception 'Se permitió envío sin aceptar términos';
 exception when others then if sqlerrm='Se permitió envío sin aceptar términos' then raise; end if; end;
 perform public.mark_order_shipped_v2(shipping_order,'TEST','TEST',true,true,'2026-09-30.1','6cc8bb0911fad410649ff35e66bfb128451141e864ffe915a711d52ef7672936');
 if not exists(select 1 from public.orders where id=shipping_order and status='shipped' and seller_shipping_terms_version='2026-09-30.1' and not shipping_insurance_confirmed and not shipping_signature_confirmed) then raise exception 'Envío simplificado incorrecto'; end if;
end $$;
select 'PASS: 4%, idempotencia, siguiente venta, saldo insuficiente, reversión, sin retroactividad y dos confirmaciones de envío' as result;
rollback;