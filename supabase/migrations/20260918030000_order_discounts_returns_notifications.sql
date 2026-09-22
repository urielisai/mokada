-- Agreed discounts are per sale, never a change to the product price list.
ALTER TABLE public.sales_order_items
  ADD COLUMN list_unit_price numeric,
  ADD COLUMN discount_percent numeric NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),
  ADD COLUMN discount_reason text,
  ADD COLUMN price_adjusted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.sales_order_items DISABLE TRIGGER a_guard_priced_order_item;
ALTER TABLE public.sales_order_items DISABLE TRIGGER trigger_recalculate_sales_order_total;
UPDATE public.sales_order_items SET list_unit_price=unit_price;
ALTER TABLE public.sales_order_items ENABLE TRIGGER a_guard_priced_order_item;
ALTER TABLE public.sales_order_items ENABLE TRIGGER trigger_recalculate_sales_order_total;

CREATE OR REPLACE FUNCTION public.guard_priced_order_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.sales_orders; v_price numeric; v_staff boolean;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END FOR UPDATE;
  IF v_order.inventory_posted_at IS NOT NULL OR v_order.status IN('SHIPPED','DELIVERED','CANCELLED') THEN RAISE EXCEPTION 'El pedido ya no permite modificar productos'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN('ADMIN','AGENT')) INTO v_staff;
  IF TG_OP='UPDATE' AND NEW.order_id<>OLD.order_id THEN RAISE EXCEPTION 'No se puede cambiar el pedido de un producto'; END IF;
  IF NEW.quantity<=0 OR NEW.quantity::text IN('NaN','Infinity','-Infinity') OR NEW.discount_percent IS NULL OR NEW.discount_percent::text IN('NaN','Infinity','-Infinity') OR NEW.discount_percent NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Cantidad o descuento inválido'; END IF;
  IF TG_OP='INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    IF v_order.price_list_id IS NOT NULL THEN
      SELECT pp.amount INTO v_price FROM public.product_prices pp JOIN public.price_lists pl ON pl.id=pp.price_list_id
        WHERE pp.product_id=NEW.product_id AND pp.price_list_id=v_order.price_list_id AND pl.is_active AND pp.valid_to IS NULL AND pp.valid_from<=now();
      IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio en la lista seleccionada'; END IF;
    ELSE
      SELECT pp.amount INTO v_price FROM public.product_prices pp JOIN public.price_lists pl ON pl.id=pp.price_list_id
        WHERE pp.product_id=NEW.product_id AND pl.is_active AND pp.valid_to IS NULL AND pp.valid_from<=now() ORDER BY pp.amount DESC LIMIT 1;
      IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio de venta'; END IF;
    END IF;
    NEW.list_unit_price:=v_price;
  ELSE
    NEW.list_unit_price:=OLD.list_unit_price;
  END IF;
  IF NOT v_staff AND (NEW.discount_percent<>0 OR (TG_OP='UPDATE' AND NEW.discount_percent IS DISTINCT FROM OLD.discount_percent)) THEN RAISE EXCEPTION 'Solo el agente o administrador puede acordar descuentos'; END IF;
  IF NEW.discount_percent>0 AND NULLIF(btrim(NEW.discount_reason),'') IS NULL THEN RAISE EXCEPTION 'Captura el motivo del descuento'; END IF;
  IF TG_OP='INSERT' OR NEW.discount_percent IS DISTINCT FROM OLD.discount_percent OR NEW.discount_reason IS DISTINCT FROM OLD.discount_reason THEN NEW.price_adjusted_by:=CASE WHEN NEW.discount_percent>0 THEN auth.uid() END;
  ELSE NEW.price_adjusted_by:=OLD.price_adjusted_by; END IF;
  NEW.unit_price:=round(NEW.list_unit_price*(1-NEW.discount_percent/100),2);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_order_item_discount(p_item_id uuid,p_discount_percent numeric,p_reason text)
RETURNS public.sales_order_items LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item public.sales_order_items; v_order_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN('ADMIN','AGENT')) THEN RAISE EXCEPTION 'Solo agentes y administradores pueden acordar descuentos'; END IF;
  SELECT order_id INTO v_order_id FROM public.sales_order_items WHERE id=p_item_id;
  PERFORM 1 FROM public.sales_orders WHERE id=v_order_id FOR UPDATE;
  UPDATE public.sales_order_items SET discount_percent=p_discount_percent,discount_reason=NULLIF(btrim(p_reason),'') WHERE id=p_item_id RETURNING * INTO v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto del pedido no encontrado'; END IF;
  RETURN v_item;
END;
$$;

CREATE TABLE public.notifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK(length(body)<=2000),
  entity_type text NOT NULL CHECK(length(btrim(entity_type)) BETWEEN 1 AND 100),
  entity_id text NOT NULL CHECK(length(btrim(entity_id)) BETWEEN 1 AND 200),
  target_path text NOT NULL CHECK(target_path LIKE '/%' AND target_path NOT LIKE '//%' AND position(chr(92) in target_path)=0),
  event_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(recipient_id,event_key)
);
CREATE INDEX notifications_recipient_created ON public.notifications(recipient_id,created_at DESC);
CREATE INDEX notifications_unread ON public.notifications(recipient_id) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated USING(recipient_id=auth.uid());
GRANT SELECT ON public.notifications TO authenticated;
CREATE FUNCTION public.mark_notifications_read(p_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.notifications SET read_at=now() WHERE recipient_id=auth.uid() AND read_at IS NULL AND (p_id IS NULL OR id=p_id); END;
$$;
CREATE FUNCTION public.send_custom_notification(p_recipients uuid[],p_title text,p_body text,p_entity_type text,p_entity_id text,p_target_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden enviar notificaciones'; END IF;
  INSERT INTO public.notifications(recipient_id,title,body,entity_type,entity_id,target_path,created_by)
    SELECT DISTINCT uid,p_title,p_body,p_entity_type,p_entity_id,p_target_path,auth.uid() FROM unnest(p_recipients) uid;
END;
$$;
REVOKE ALL ON FUNCTION public.set_order_item_discount(uuid,numeric,text),public.mark_notifications_read(uuid),public.send_custom_notification(uuid[],text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_order_item_discount(uuid,numeric,text),public.mark_notifications_read(uuid),public.send_custom_notification(uuid[],text,text,text,text,text) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Warranty claims are registered immediately, with no approval step. Returned
-- defective units stay outside saleable inventory. Costs are private snapshots.
CREATE TABLE public.sales_order_returns(
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.sales_orders(id),
  item_id uuid NOT NULL REFERENCES public.sales_order_items(id),
  quantity integer NOT NULL CHECK(quantity>0),
  reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),
  evidence_paths text[] NOT NULL CHECK(cardinality(evidence_paths) BETWEEN 1 AND 5),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX returns_order ON public.sales_order_returns(order_id);
CREATE INDEX returns_item ON public.sales_order_returns(item_id);
CREATE TABLE public.sales_return_costs(
  return_id uuid PRIMARY KEY REFERENCES public.sales_order_returns(id),
  unit_cost numeric CHECK(unit_cost>=0),
  original_unit_cost numeric CHECK(original_unit_cost>=0)
);
ALTER TABLE public.sales_order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY returns_visible_order ON public.sales_order_returns FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sales_orders o WHERE o.id=order_id));
CREATE POLICY return_costs_admin ON public.sales_return_costs FOR SELECT TO authenticated USING(public.is_inventory_admin());
GRANT SELECT ON public.sales_order_returns,public.sales_return_costs TO authenticated;
ALTER TABLE public.sales_orders ADD COLUMN warranty_return_id uuid REFERENCES public.sales_order_returns(id);
CREATE UNIQUE INDEX warranty_one_active_replacement ON public.sales_orders(warranty_return_id) WHERE status<>'CANCELLED';

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('return-evidence','return-evidence',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf']);
CREATE POLICY return_evidence_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  bucket_id='return-evidence' AND (storage.foldername(name))[1]=auth.uid()::text
  AND EXISTS(SELECT 1 FROM public.sales_orders o WHERE o.id::text=(storage.foldername(name))[2] AND o.status='DELIVERED')
);
CREATE POLICY return_evidence_read ON storage.objects FOR SELECT TO authenticated USING(
  bucket_id='return-evidence' AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(
    SELECT 1 FROM public.sales_order_returns r WHERE name=ANY(r.evidence_paths)))
);
CREATE POLICY return_evidence_cleanup ON storage.objects FOR DELETE TO authenticated USING(
  bucket_id='return-evidence' AND (storage.foldername(name))[1]=auth.uid()::text
  AND NOT EXISTS(SELECT 1 FROM public.sales_order_returns r WHERE name=ANY(r.evidence_paths))
);

CREATE FUNCTION public.request_order_return(p_id uuid,p_item_id uuid,p_quantity integer,p_reason text,p_evidence_paths text[])
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
  SELECT COALESCE(sum(quantity),0) INTO v_used FROM public.sales_order_returns WHERE item_id=p_item_id;
  IF p_quantity>v_item.quantity-v_used THEN RAISE EXCEPTION 'Cantidad superior a la disponible para devolución: %',v_item.quantity-v_used; END IF;
  IF cardinality(p_evidence_paths) IS NULL OR cardinality(p_evidence_paths) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Adjunta entre una y cinco evidencias'; END IF;
  IF cardinality(p_evidence_paths)<>(SELECT count(DISTINCT p) FROM unnest(p_evidence_paths) p) THEN RAISE EXCEPTION 'Evidencias repetidas'; END IF;
  FOREACH v_path IN ARRAY p_evidence_paths LOOP
    IF v_path NOT LIKE auth.uid()::text||'/'||v_order.id::text||'/'||p_id::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='return-evidence' AND name=v_path) THEN RAISE EXCEPTION 'La evidencia no corresponde a esta devolución'; END IF;
  END LOOP;
  INSERT INTO public.sales_order_returns(id,order_id,item_id,quantity,reason,evidence_paths,requested_by)
    VALUES(p_id,v_order.id,p_item_id,p_quantity,btrim(p_reason),p_evidence_paths,auth.uid()) RETURNING * INTO v_return;
  SELECT * INTO v_cost FROM public.sales_item_costs WHERE item_id=p_item_id;
  INSERT INTO public.sales_return_costs VALUES(p_id,v_cost.unit_cost,v_cost.original_unit_cost);
  INSERT INTO public.notifications(recipient_id,title,body,entity_type,entity_id,target_path,event_key,created_by)
    SELECT auth_user_id,'Garantía registrada',left(p_quantity||' pieza(s) de '||p.code||': '||p.name||'. '||btrim(p_reason),2000),
      'sales_order_returns',p_id::text,'/orders/'||v_order.id::text||'?return='||p_id::text,'warranty:'||p_id::text,auth.uid()
    FROM public.user_profiles u CROSS JOIN public.products p WHERE u.is_active AND u.user_type='ADMIN' AND p.id=v_item.product_id;
  RETURN v_return;
END;
$$;

CREATE FUNCTION public.guard_warranty_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.warranty_return_id IS DISTINCT FROM NEW.warranty_return_id THEN RAISE EXCEPTION 'La garantía se vincula al crear el pedido'; END IF;
    IF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' AND EXISTS(SELECT 1 FROM public.sales_order_returns WHERE order_id=OLD.id) THEN RAISE EXCEPTION 'Este pedido tiene devoluciones registradas y no puede cancelarse completo'; END IF;
  ELSIF NEW.warranty_return_id IS NOT NULL THEN
    IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden crear pedidos de reposición'; END IF;
    PERFORM 1 FROM public.sales_order_returns r JOIN public.sales_orders o ON o.id=r.order_id
      WHERE r.id=NEW.warranty_return_id AND o.customer_id=NEW.customer_id AND o.branch_id IS NOT DISTINCT FROM NEW.branch_id FOR UPDATE OF r;
    IF NOT FOUND THEN RAISE EXCEPTION 'La garantía no corresponde al cliente y sucursal'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a_guard_warranty_order BEFORE INSERT OR UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.guard_warranty_order();
CREATE FUNCTION public.guard_warranty_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.sales_order_returns; v_product uuid; v_total integer;
BEGIN
  SELECT r.* INTO v_return FROM public.sales_orders o JOIN public.sales_order_returns r ON r.id=o.warranty_return_id WHERE o.id=NEW.order_id;
  IF FOUND THEN
    SELECT product_id INTO v_product FROM public.sales_order_items WHERE id=v_return.item_id;
    SELECT COALESCE(sum(quantity),0) INTO v_total FROM public.sales_order_items WHERE order_id=NEW.order_id AND id<>NEW.id;
    IF NEW.product_id<>v_product OR v_total+NEW.quantity>v_return.quantity THEN RAISE EXCEPTION 'La reposición debe corresponder al producto y cantidad de la garantía'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER b_guard_warranty_item BEFORE INSERT OR UPDATE ON public.sales_order_items FOR EACH ROW EXECUTE FUNCTION public.guard_warranty_item();

ALTER TABLE public.sales_order_payments ADD COLUMN is_manual_settlement boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.guard_manual_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_manual_settlement AND NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden registrar liquidaciones manuales'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_manual_settlement BEFORE INSERT OR UPDATE ON public.sales_order_payments FOR EACH ROW EXECUTE FUNCTION public.guard_manual_settlement();
CREATE FUNCTION public.mark_order_paid_manually(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.sales_orders; v_due numeric;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden marcar pagado manualmente'; END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status='CANCELLED' THEN RAISE EXCEPTION 'Pedido no disponible'; END IF;
  v_due:=v_order.total_amount+COALESCE(v_order.shipping_cost,0)-COALESCE(v_order.amount_paid,0);
  IF v_due>0 THEN
    IF EXISTS(SELECT 1 FROM public.sales_order_payments WHERE order_id=p_order_id AND status='PENDING') THEN RAISE EXCEPTION 'Resuelve los pagos pendientes antes de marcar pagado manualmente'; END IF;
    INSERT INTO public.sales_order_payments(order_id,amount,payment_method,status,created_by,approved_by,comments,is_manual_settlement)
      VALUES(p_order_id,v_due,'CASH','APPROVED',auth.uid(),auth.uid(),'Marcado pagado manualmente por administrador'||CASE WHEN v_order.warranty_return_id IS NOT NULL THEN ' (reposición por garantía, sin nuevo cobro)' ELSE '' END,true);
  END IF;
END;
$$;
CREATE FUNCTION public.set_return_cost(p_return_id uuid,p_unit_cost numeric,p_original_unit_cost numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden configurar costos'; END IF;
  IF p_unit_cost IS NULL OR p_original_unit_cost IS NULL OR p_unit_cost<0 OR p_original_unit_cost<0 OR p_unit_cost::text IN('NaN','Infinity','-Infinity') OR p_original_unit_cost::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Costo inválido'; END IF;
  UPDATE public.sales_return_costs SET unit_cost=p_unit_cost,original_unit_cost=p_original_unit_cost WHERE return_id=p_return_id AND (unit_cost IS NULL OR original_unit_cost IS NULL);
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo configura costos desconocidos de garantías anteriores'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.request_order_return(uuid,uuid,integer,text,text[]),public.mark_order_paid_manually(uuid),public.set_return_cost(uuid,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_order_return(uuid,uuid,integer,text,text[]),public.mark_order_paid_manually(uuid),public.set_return_cost(uuid,numeric,numeric) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_order_returns;

-- One warranty expense per claim. Use actual replacement costs when dispatched;
-- before dispatch, use the original sale cost as an estimate. Replacement orders
-- consume inventory normally but their manual payment is not new sales revenue.
CREATE VIEW public.warranty_expenses WITH(security_invoker=true) AS
SELECT r.id AS return_id,r.item_id,r.order_id,r.quantity,
 CASE WHEN count(rc.item_id)>0 THEN sum(ri.quantity*rc.unit_cost)+CASE WHEN r.quantity>sum(ri.quantity) THEN (r.quantity-sum(ri.quantity))*c.unit_cost ELSE 0 END ELSE r.quantity*c.unit_cost END AS warehouse_expense,
 CASE WHEN count(rc.item_id)>0 THEN sum(ri.quantity*rc.original_unit_cost)+CASE WHEN r.quantity>sum(ri.quantity) THEN (r.quantity-sum(ri.quantity))*c.original_unit_cost ELSE 0 END ELSE r.quantity*c.original_unit_cost END AS original_expense
FROM public.sales_order_returns r LEFT JOIN public.sales_return_costs c ON c.return_id=r.id
LEFT JOIN public.sales_orders ro ON ro.warranty_return_id=r.id AND ro.inventory_posted_at IS NOT NULL AND ro.status IN('SHIPPED','DELIVERED')
LEFT JOIN public.sales_order_items ri ON ri.order_id=ro.id LEFT JOIN public.sales_item_costs rc ON rc.item_id=ri.id
WHERE public.is_inventory_admin() GROUP BY r.id,c.unit_cost,c.original_unit_cost;
CREATE OR REPLACE VIEW public.sales_margins WITH(security_invoker=true) AS
SELECT o.id AS order_id,o.created_by AS agent_id,o.warehouse_id,w.name AS warehouse_name,o.status,
 o.inventory_posted_at AS sold_at,o.amount_paid,o.total_amount,i.id AS item_id,p.code,p.name,i.quantity,i.unit_price,i.subtotal,
 c.unit_cost,c.original_unit_cost,
 i.subtotal-i.quantity*c.unit_cost-CASE WHEN e.unknown THEN NULL ELSE COALESCE(e.warehouse_expense,0) END AS warehouse_margin,
 i.quantity*(c.unit_cost-c.original_unit_cost)-CASE WHEN e.unknown THEN NULL ELSE COALESCE(e.warehouse_expense-e.original_expense,0) END AS upstream_margin,
 i.subtotal-i.quantity*c.original_unit_cost-CASE WHEN e.unknown THEN NULL ELSE COALESCE(e.original_expense,0) END AS gross_profit,
 CASE WHEN e.unknown THEN NULL ELSE COALESCE(e.original_expense,0) END AS warranty_loss,
 COALESCE(e.returned_quantity,0) AS returned_quantity
FROM public.sales_orders o JOIN public.sales_order_items i ON i.order_id=o.id JOIN public.products p ON p.id=i.product_id
LEFT JOIN public.sales_item_costs c ON c.item_id=i.id LEFT JOIN public.warehouses w ON w.id=o.warehouse_id
LEFT JOIN (SELECT item_id,sum(warehouse_expense) warehouse_expense,sum(original_expense) original_expense,sum(quantity) returned_quantity,
 bool_or(warehouse_expense IS NULL OR original_expense IS NULL) AS unknown FROM public.warranty_expenses GROUP BY item_id) e ON e.item_id=i.id
WHERE o.inventory_posted_at IS NOT NULL AND o.status IN('SHIPPED','DELIVERED') AND o.warranty_return_id IS NULL AND public.is_inventory_admin();
GRANT SELECT ON public.warranty_expenses,public.sales_margins TO authenticated;

CREATE OR REPLACE FUNCTION public.create_priced_order(p_payload jsonb) RETURNS public.sales_orders
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.sales_orders; v_item jsonb; v_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN ('ADMIN','AGENT')) INTO v_staff;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Agrega productos al pedido'; END IF;
  IF jsonb_array_length(p_payload->'items')=0 THEN RAISE EXCEPTION 'Pedido vacío'; END IF;
  IF v_staff AND ((p_payload->>'warehouse_id') IS NULL OR (p_payload->>'price_list_id') IS NULL) THEN RAISE EXCEPTION 'Selecciona almacén y lista de precios'; END IF;
  IF v_staff AND (NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=(p_payload->>'warehouse_id')::uuid AND is_active) OR NOT EXISTS(SELECT 1 FROM public.price_lists WHERE id=(p_payload->>'price_list_id')::uuid AND is_active)) THEN RAISE EXCEPTION 'Selecciona almacén y lista de precios activos'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_branches WHERE id=(p_payload->>'branch_id')::uuid AND customer_id=(p_payload->>'customer_id')::uuid) THEN RAISE EXCEPTION 'Sucursal inválida'; END IF;
  INSERT INTO public.sales_orders(customer_id,created_by,total_amount,shipping_address,branch_id,warehouse_id,price_list_id,payment_type,credit_term_days,credit_approval_status,credit_approved_by,warranty_return_id)
  VALUES((p_payload->>'customer_id')::uuid,auth.uid(),0,p_payload->>'shipping_address',(p_payload->>'branch_id')::uuid,
    CASE WHEN v_staff THEN (p_payload->>'warehouse_id')::uuid END,CASE WHEN v_staff THEN (p_payload->>'price_list_id')::uuid END,
    COALESCE(p_payload->>'payment_type','CONTADO'),(p_payload->>'credit_term_days')::integer,
    CASE WHEN p_payload->>'payment_type'='CREDITO' THEN CASE WHEN v_staff THEN 'APPROVED' ELSE 'PENDING' END ELSE 'NOT_REQUESTED' END,
    CASE WHEN v_staff AND p_payload->>'payment_type'='CREDITO' THEN auth.uid() END,(p_payload->>'warranty_return_id')::uuid) RETURNING * INTO v_order;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    INSERT INTO public.sales_order_items(order_id,product_id,quantity,unit_price,subtotal,discount_percent,discount_reason)
    VALUES(v_order.id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,0,COALESCE((v_item->>'discount_percent')::numeric,0),v_item->>'discount_reason');
  END LOOP;
  SELECT * INTO v_order FROM public.sales_orders WHERE id=v_order.id;
  RETURN v_order;
END;
$$;
