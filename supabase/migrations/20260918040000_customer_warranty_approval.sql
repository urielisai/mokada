-- Customer claims wait for administrator review; agents register directly.
-- Earlier claims already linked to a replacement retain their authorization.
ALTER TABLE public.sales_order_returns
 ADD COLUMN status text NOT NULL DEFAULT 'APPROVED' CHECK(status IN('PENDING','APPROVED','REJECTED')),
 ADD COLUMN auto_approved boolean NOT NULL DEFAULT true,
 ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
 ADD COLUMN reviewed_at timestamptz,
 ADD COLUMN review_comment text CHECK(length(review_comment)<=2000);

UPDATE public.sales_order_returns r SET status='PENDING',auto_approved=false
WHERE EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.auth_user_id=r.requested_by AND u.user_type='CUSTOMER')
 AND NOT EXISTS(SELECT 1 FROM public.sales_orders o WHERE o.warranty_return_id=r.id);
INSERT INTO public.notifications(recipient_id,title,body,entity_type,entity_id,target_path,event_key)
SELECT u.auth_user_id,'Garantía pendiente de aprobación','Revisa la evidencia y decide si procede la reposición.',
 'sales_order_returns',r.id::text,'/orders/'||r.order_id::text||'?return='||r.id::text,'warranty:'||r.id::text
FROM public.sales_order_returns r CROSS JOIN public.user_profiles u WHERE r.status='PENDING' AND u.is_active AND u.user_type='ADMIN'
ON CONFLICT(recipient_id,event_key) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,read_at=NULL;

CREATE FUNCTION public.review_order_return(p_return_id uuid,p_approve boolean,p_comment text DEFAULT NULL)
RETURNS public.sales_order_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.sales_order_returns;v_order_id uuid;v_status text;v_path text;
BEGIN
 IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden aprobar o rechazar garantías'; END IF;
 IF p_approve IS NULL THEN RAISE EXCEPTION 'Selecciona aprobar o rechazar'; END IF;
 IF length(p_comment)>2000 THEN RAISE EXCEPTION 'El comentario admite hasta 2000 caracteres'; END IF;
 SELECT order_id INTO v_order_id FROM public.sales_order_returns WHERE id=p_return_id;
 PERFORM 1 FROM public.sales_orders WHERE id=v_order_id FOR UPDATE;
 SELECT * INTO v_return FROM public.sales_order_returns WHERE id=p_return_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud de garantía no encontrada'; END IF;
 v_status:=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END;
 IF v_return.status=v_status THEN RETURN v_return; END IF;
 IF v_return.status<>'PENDING' THEN RAISE EXCEPTION 'Esta solicitud ya fue resuelta'; END IF;
 IF NOT p_approve AND NULLIF(btrim(p_comment),'') IS NULL THEN RAISE EXCEPTION 'Captura el motivo del rechazo'; END IF;
 UPDATE public.sales_order_returns SET status=v_status,auto_approved=false,reviewed_by=auth.uid(),reviewed_at=now(),review_comment=NULLIF(btrim(p_comment),'') WHERE id=p_return_id RETURNING * INTO v_return;
 v_path:='/my-orders?order='||v_return.order_id::text||'&return='||p_return_id::text;
 INSERT INTO public.notifications(recipient_id,title,body,entity_type,entity_id,target_path,event_key,created_by)
 VALUES(v_return.requested_by,CASE WHEN p_approve THEN 'Garantía aprobada' ELSE 'Garantía rechazada' END,
  CASE WHEN p_approve THEN 'El administrador autorizó la reposición del producto.' ELSE 'La garantía no procede. Motivo: '||left(btrim(p_comment),1800) END,
  'sales_order_returns',p_return_id::text,v_path,'warranty-review:'||p_return_id::text,auth.uid());
 RETURN v_return;
END;
$$;
REVOKE ALL ON FUNCTION public.review_order_return(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_order_return(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_order_return(p_id uuid,p_item_id uuid,p_quantity integer,p_reason text,p_evidence_paths text[])
RETURNS public.sales_order_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item public.sales_order_items; v_order public.sales_orders; v_return public.sales_order_returns;
  v_cost public.sales_item_costs; v_staff boolean; v_path text; v_used integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active) THEN RAISE EXCEPTION 'Inicia sesión con una cuenta activa'; END IF;
  SELECT * INTO v_item FROM public.sales_order_items WHERE id=p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto del pedido no encontrado'; END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id=v_item.order_id FOR UPDATE;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN('ADMIN','AGENT')) INTO v_staff;
  IF NOT v_staff AND NOT EXISTS(SELECT 1 FROM public.customers WHERE id=v_order.customer_id AND auth_user_id=auth.uid()) THEN RAISE EXCEPTION 'No tienes acceso a este pedido'; END IF;
  SELECT * INTO v_return FROM public.sales_order_returns WHERE id=p_id;
  IF FOUND THEN
    IF v_return.requested_by=auth.uid() AND v_return.item_id=p_item_id AND v_return.quantity=p_quantity AND v_return.reason=btrim(p_reason) AND v_return.evidence_paths=p_evidence_paths THEN RETURN v_return; END IF;
    RAISE EXCEPTION 'La referencia de devolución ya está utilizada';
  END IF;
  IF v_order.status<>'DELIVERED' THEN RAISE EXCEPTION 'Solo puedes devolver productos de pedidos entregados'; END IF;
  IF p_quantity IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'Captura una cantidad válida'; END IF;
  SELECT COALESCE(sum(quantity),0) INTO v_used FROM public.sales_order_returns WHERE item_id=p_item_id AND status<>'REJECTED';
  IF p_quantity>v_item.quantity-v_used THEN RAISE EXCEPTION 'Cantidad superior a la disponible para devolución: %',v_item.quantity-v_used; END IF;
  IF cardinality(p_evidence_paths) IS NULL OR cardinality(p_evidence_paths) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Adjunta entre una y cinco evidencias'; END IF;
  IF cardinality(p_evidence_paths)<>(SELECT count(DISTINCT p) FROM unnest(p_evidence_paths) p) THEN RAISE EXCEPTION 'Evidencias repetidas'; END IF;
  FOREACH v_path IN ARRAY p_evidence_paths LOOP
    IF v_path NOT LIKE auth.uid()::text||'/'||v_order.id::text||'/'||p_id::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='return-evidence' AND name=v_path) THEN RAISE EXCEPTION 'La evidencia no corresponde a esta devolución'; END IF;
  END LOOP;
  INSERT INTO public.sales_order_returns(id,order_id,item_id,quantity,reason,evidence_paths,requested_by,status,auto_approved,reviewed_by,reviewed_at)
    VALUES(p_id,v_order.id,p_item_id,p_quantity,btrim(p_reason),p_evidence_paths,auth.uid(),CASE WHEN v_staff THEN 'APPROVED' ELSE 'PENDING' END,v_staff,CASE WHEN v_staff THEN auth.uid() END,CASE WHEN v_staff THEN now() END) RETURNING * INTO v_return;
  SELECT * INTO v_cost FROM public.sales_item_costs WHERE item_id=p_item_id;
  INSERT INTO public.sales_return_costs VALUES(p_id,v_cost.unit_cost,v_cost.original_unit_cost);
  INSERT INTO public.notifications(recipient_id,title,body,entity_type,entity_id,target_path,event_key,created_by)
    SELECT auth_user_id,CASE WHEN v_staff THEN 'Garantía registrada' ELSE 'Garantía pendiente de aprobación' END,left(p_quantity||' pieza(s) de '||p.code||': '||p.name||'. '||btrim(p_reason),2000),
      'sales_order_returns',p_id::text,'/orders/'||v_order.id::text||'?return='||p_id::text,'warranty:'||p_id::text,auth.uid()
    FROM public.user_profiles u CROSS JOIN public.products p WHERE u.is_active AND u.user_type='ADMIN' AND p.id=v_item.product_id;
  RETURN v_return;
END;
$$;


CREATE OR REPLACE FUNCTION public.guard_warranty_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.warranty_return_id IS DISTINCT FROM NEW.warranty_return_id THEN RAISE EXCEPTION 'La garantía se vincula al crear el pedido'; END IF;
    IF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' AND EXISTS(SELECT 1 FROM public.sales_order_returns WHERE order_id=OLD.id AND status<>'REJECTED') THEN RAISE EXCEPTION 'Este pedido tiene devoluciones registradas y no puede cancelarse completo'; END IF;
  ELSIF NEW.warranty_return_id IS NOT NULL THEN
    IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden crear pedidos de reposición'; END IF;
    IF EXISTS(SELECT 1 FROM public.sales_order_returns WHERE id=NEW.warranty_return_id AND status<>'APPROVED') THEN RAISE EXCEPTION 'Aprueba la garantía antes de crear el pedido de reposición'; END IF;
    PERFORM 1 FROM public.sales_order_returns r JOIN public.sales_orders o ON o.id=r.order_id
      WHERE r.id=NEW.warranty_return_id AND r.status='APPROVED' AND o.customer_id=NEW.customer_id AND o.branch_id IS NOT DISTINCT FROM NEW.branch_id FOR UPDATE OF r;
    IF NOT FOUND THEN RAISE EXCEPTION 'La garantía no corresponde al cliente y sucursal'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.warranty_expenses WITH(security_invoker=true) AS
SELECT r.id AS return_id,r.item_id,r.order_id,r.quantity,
 CASE WHEN count(rc.item_id)>0 THEN sum(ri.quantity*rc.unit_cost)+CASE WHEN r.quantity>sum(ri.quantity) THEN (r.quantity-sum(ri.quantity))*c.unit_cost ELSE 0 END ELSE r.quantity*c.unit_cost END AS warehouse_expense,
 CASE WHEN count(rc.item_id)>0 THEN sum(ri.quantity*rc.original_unit_cost)+CASE WHEN r.quantity>sum(ri.quantity) THEN (r.quantity-sum(ri.quantity))*c.original_unit_cost ELSE 0 END ELSE r.quantity*c.original_unit_cost END AS original_expense
FROM public.sales_order_returns r LEFT JOIN public.sales_return_costs c ON c.return_id=r.id
LEFT JOIN public.sales_orders ro ON ro.warranty_return_id=r.id AND ro.inventory_posted_at IS NOT NULL AND ro.status IN('SHIPPED','DELIVERED')
LEFT JOIN public.sales_order_items ri ON ri.order_id=ro.id LEFT JOIN public.sales_item_costs rc ON rc.item_id=ri.id
WHERE r.status='APPROVED' AND public.is_inventory_admin() GROUP BY r.id,c.unit_cost,c.original_unit_cost;
