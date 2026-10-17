-- Temporary fixtures only, all state changes roll back, no messages are sent externally.
begin;
do $$
declare a uuid; b uuid; v uuid; d uuid; d2 uuid; d3 uuid; c uuid; c2 uuid; c3 uuid; o uuid; existing uuid; blocked boolean;
begin
 select id into a from public.profiles where role='admin' limit 1;
 select id into b from public.profiles where role<>'admin' and not coalesce(is_blocked,false) order by created_at limit 1;
 select id into v from public.profiles where role<>'admin' and not coalesce(is_blocked,false) and id<>b order by created_at limit 1;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 for existing in select id from public.conversations where buyer_id=a or seller_id=a loop perform public.mark_conversation_read(existing); end loop;
 if public.count_unread_message_people()<>0 then raise exception 'Read cursor did not clear inbox'; end if;
 insert into public.dresses(seller_id,model,envio_nacional) values(a,'ROLLBACK_INBOX_ONE',true) returning id into d;
 insert into public.dresses(seller_id,model,envio_nacional) values(a,'ROLLBACK_INBOX_TWO',true) returning id into d2;
 insert into public.dresses(seller_id,model,envio_nacional) values(v,'ROLLBACK_INBOX_OTHER',true) returning id into d3;
 insert into public.conversations(dress_id,buyer_id,seller_id) values(d,b,a) returning id into c;
 insert into public.conversations(dress_id,buyer_id,seller_id) values(d2,b,a) returning id into c2;
 insert into public.conversations(dress_id,buyer_id,seller_id) values(d3,b,v) returning id into c3;
 perform set_config('request.jwt.claim.sub',b::text,true);
 insert into public.messages(conversation_id,sender_id,body,created_at) values(c,b,'Pregunta temporal sobre medidas del vestido',now()-interval '1 second'),(c,b,'Consulta temporal sobre el largo de la falda',now()-interval '1 second'),(c2,b,'Otra consulta temporal sobre la talla',now()-interval '1 second');
 perform set_config('request.jwt.claim.sub',v::text,true);
 insert into public.messages(conversation_id,sender_id,body) values(c3,v,'Respuesta temporal fuera de la bandeja administradora');
 perform set_config('request.jwt.claim.sub',a::text,true);
 if public.count_unread_message_people()<>1 then raise exception 'Messages from same sender were not grouped, or admin counted other inboxes'; end if;
 perform public.mark_conversation_read(c);
 if public.count_unread_message_people()<>1 then raise exception 'Unread second conversation from same sender was lost'; end if;
 perform public.mark_conversation_read(c2);
 if public.count_unread_message_people()<>0 then raise exception 'Read messages still counted'; end if;
 -- Own outgoing messages must not increase the counter.
 insert into public.messages(conversation_id,sender_id,body) values(c,a,'Respuesta temporal de la propia usuaria');
 if public.count_unread_message_people()<>0 then raise exception 'Own message counted'; end if;
 -- An open order blocks removal even if the dress still has draft status.
 insert into public.orders(dress_id,buyer_id,seller_id,subtotal_mxn,total_mxn,seller_net_mxn,status) values(d,b,a,1000,1000,820,'paid') returning id into o;
 blocked:=false;
 begin perform public.remove_own_dress_listing(d); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Open sale was removable'; end if;
 update public.orders set status='cancelled' where id=o;
 perform public.remove_own_dress_listing(d);
 if not exists(select 1 from public.dresses where id=d and removed_by_seller_at is not null and status='archived') then raise exception 'Listing was not removed after sale closed'; end if;
end $$;
select 'PASS: people grouping, multiple conversations, admin scoping, read cursors, own messages, active sale deletion guard' as result;
rollback;
