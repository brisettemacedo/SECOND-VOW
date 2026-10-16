-- Integration checks use synthetic records and always roll back, no Stripe calls.
begin;
do $$
declare a uuid; b uuid; v uuid; d uuid; o uuid; c uuid; blocked boolean;
begin
  select id into a from public.profiles where role='admin' limit 1;
  select id into b from public.profiles where role<>'admin' order by created_at limit 1;
  select id into v from public.profiles where role<>'admin' and id<>b order by created_at limit 1;
  if a is null or b is null or v is null then raise exception 'Missing test actors'; end if;
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  insert into public.dresses(seller_id,model,envio_nacional) values(v,'ROLLBACK_RETURN_TEST',true) returning id into d;
  insert into public.orders(dress_id,buyer_id,seller_id,subtotal_mxn,shipping_mxn,total_mxn,commission_mxn,seller_net_mxn,status,checkout_terms_version)
    values(d,b,v,1000,100,1100,198,902,'claim_open','2026-10-16.1') returning id into o;
  insert into public.seller_payouts(order_id,seller_id,amount_mxn,status) values(o,v,902,'paused');
  insert into public.claims(order_id,opened_by,reason,reason_code,description,seller_responded_at)
    values(o,b,'damaged_undisclosed','damaged_undisclosed','Defecto estructural grave no declarado, prueba temporal',now()) returning id into c;
  blocked:=false;
  begin
    perform public.admin_resolve_claim_v2(c,'authorize_return','buyer','buyer_fit_or_remorse','No le gustó cómo le quedó',false,0,0,false);
  exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Uncovered fit return was accepted'; end if;
  perform public.admin_resolve_claim_v2(c,'authorize_return','seller','seller_misrepresentation','Defecto estructural grave acreditado en la evidencia',false,0,0,false);
  perform public.admin_set_return_instructions(c,'Destino de prueba confirmado, flete por cobrar autorizado y cobertura verificada','collect');
  if (select count(distinct user_id) from public.notifications where order_id=o and kind='return_instructions_ready')<>2 then raise exception 'Missing bilateral instructions'; end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  blocked:=false;
  begin perform public.admin_review_return(c,'Intento no administrativo de liberar dinero'); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Buyer bypassed admin authorization'; end if;
  blocked:=false;
  begin perform public.register_return_shipment(o,'TEST_CARRIER','TEST_'||o::text); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Tracking without admission proof accepted'; end if;
  insert into public.order_evidence(order_id,uploaded_by,evidence_type,storage_path) values(o,b,'buyer_return_packed',b::text||'/'||o::text||'/test-receipt.jpg');
  perform public.register_return_shipment(o,'TEST_CARRIER','TEST_'||o::text);
  if (select return_reviewed_at from public.claims where id=c) is not null then raise exception 'Tracking automatically approved money'; end if;
  if (select status from public.seller_payouts where order_id=o)<>'paused' then raise exception 'Tracking released seller balance'; end if;
  if (select count(distinct user_id) from public.notifications where order_id=o and kind='order_return_shipped')<>2 then raise exception 'Missing bilateral shipment notifications'; end if;
  perform set_config('request.jwt.claim.sub',a::text,true);
  blocked:=false;
  begin perform public.admin_review_return(c,'Admisión de retorno verificada y expediente resuelto'); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Appeal window bypassed'; end if;
  update public.claim_resolutions set appeal_deadline_at=now()-interval '1 second' where claim_id=c;
  perform public.admin_review_return(c,'Guía y admisión verificadas, destino correcto y expediente resuelto sin exigir confirmación de vendedora');
  if (select return_reviewed_by from public.claims where id=c)<>a then raise exception 'Admin review missing'; end if;
  if (select return_delivered_at from public.claims where id=c) is not null then raise exception 'Administrative review invented delivery'; end if;
  if exists(select 1 from public.refunds where order_id=o) then raise exception 'Review executed a refund'; end if;
  if (select status from public.seller_payouts where order_id=o)<>'paused' then raise exception 'Review released seller balance'; end if;
  if (select count(distinct user_id) from public.notifications where order_id=o and kind='return_reviewed')<>2 then raise exception 'Missing bilateral review notices'; end if;
  perform public.admin_review_return(c,'Reintento con la misma guía y solución documentada');
  if (select count(*) from public.order_events where order_id=o and event_type='return_reviewed')<>1 then raise exception 'Duplicated review event'; end if;
  -- A provisional rejection must retain funds during the appeal window.
  insert into public.dresses(seller_id,model,envio_nacional) values(v,'ROLLBACK_REJECTION_TEST',true) returning id into d;
  insert into public.orders(dress_id,buyer_id,seller_id,subtotal_mxn,total_mxn,seller_net_mxn,status,checkout_terms_version,platform_delivery_recorded_at,dispute_deadline_at)
    values(d,b,v,1000,1000,820,'claim_open','2026-10-16.1',now()-interval '4 days',now()-interval '2 days') returning id into o;
  insert into public.seller_payouts(order_id,seller_id,amount_mxn,status) values(o,v,820,'paused');
  insert into public.claims(order_id,opened_by,reason,description,seller_responded_at)
    values(o,b,'damaged_undisclosed','Reclamación sin acreditación para prueba temporal',now()) returning id into c;
  perform public.admin_resolve_claim_v2(c,'reject','none','insufficient_evidence','No se acreditó un defecto grave no declarado',false,0,0,false);
  if (select status from public.orders where id=o)<>'claim_open' or (select status from public.seller_payouts where order_id=o)<>'paused' then raise exception 'Provisional rejection released funds'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.backend_finalize_claim_reviews();
  if (select status from public.orders where id=o)<>'claim_open' then raise exception 'Cron bypassed appeal window'; end if;
  perform set_config('request.jwt.claim.role','authenticated',true);
  update public.claim_resolutions set appeal_deadline_at=now()-interval '1 second' where claim_id=c;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.backend_finalize_claim_reviews();
  if (select status from public.orders where id=o)<>'inspection' or (select status from public.seller_payouts where order_id=o)<>'held' then raise exception 'Closed rejection did not restore normal lifecycle'; end if;
end $$;
select 'PASS: authorized collect return, permissions, admission proof, review window, retained funds, bilateral notices, idempotency, rejection appeal hold' as result;
rollback;
