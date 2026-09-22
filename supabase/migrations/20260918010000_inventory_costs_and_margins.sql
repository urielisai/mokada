-- Internal transfer prices never overwrite customer price lists.
-- Unknown historical costs remain NULL until an administrator supplies them.
ALTER TABLE public.inventory_transfer_items ADD COLUMN IF NOT EXISTS unit_price numeric(14,2);
ALTER TABLE public.inventory_transfer_items ADD CONSTRAINT transfer_price_nonnegative CHECK (unit_price IS NULL OR unit_price >= 0);
ALTER TABLE public.inventory_movements ADD COLUMN original_unit_cost numeric(14,4);
ALTER TABLE public.sales_orders
  ADD COLUMN warehouse_id uuid REFERENCES public.warehouses(id),
  ADD COLUMN price_list_id uuid REFERENCES public.price_lists(id),
  ADD COLUMN inventory_posted_at timestamptz,
  ADD COLUMN inventory_tracking_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.sales_orders ALTER COLUMN inventory_tracking_enabled SET DEFAULT true;
UPDATE public.sales_orders SET inventory_tracking_enabled=true WHERE status IN ('PENDING','VALIDATING','CONFIRMED');

CREATE TABLE public.inventory_costs (
  inventory_id uuid PRIMARY KEY REFERENCES public.product_inventory(id) ON DELETE CASCADE,
  average_cost numeric(14,4) CHECK (average_cost >= 0),
  original_average_cost numeric(14,4) CHECK (original_average_cost >= 0)
);
CREATE TABLE public.sales_item_costs (
  item_id uuid PRIMARY KEY REFERENCES public.sales_order_items(id) ON DELETE RESTRICT,
  unit_cost numeric(14,4),
  original_unit_cost numeric(14,4)
);
ALTER TABLE public.inventory_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_item_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_costs, public.sales_item_costs FROM anon, authenticated;
GRANT SELECT ON public.inventory_costs, public.sales_item_costs TO authenticated;

CREATE FUNCTION public.is_inventory_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND user_type = 'ADMIN' AND is_active);
$$;
CREATE POLICY admin_costs_read ON public.inventory_costs FOR SELECT TO authenticated USING (public.is_inventory_admin());
CREATE POLICY admin_sale_costs_read ON public.sales_item_costs FOR SELECT TO authenticated USING (public.is_inventory_admin());
-- Costs and internal prices belong to administration, not the customer API.
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_active_access ON public.inventory_movements;
DROP POLICY IF EXISTS authenticated_active_access ON public.inventory_transfers;
DROP POLICY IF EXISTS authenticated_active_access ON public.inventory_transfer_items;
DROP POLICY IF EXISTS authenticated_active_access ON public.product_inventory;
CREATE POLICY admin_movements_read ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_inventory_admin());
CREATE POLICY admin_transfers ON public.inventory_transfers FOR ALL TO authenticated USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin());
CREATE POLICY admin_transfer_items ON public.inventory_transfer_items FOR ALL TO authenticated USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin());
CREATE POLICY inventory_read ON public.product_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_inventory_settings ON public.product_inventory FOR ALL TO authenticated USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin());
REVOKE INSERT,UPDATE,DELETE ON public.inventory_movements FROM anon,authenticated;
REVOKE ALL ON public.inventory_transfers,public.inventory_transfer_items FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.product_inventory FROM anon;

CREATE FUNCTION public.guard_transfer_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'El traspaso ya no permite cambios'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.status='COMPLETED' AND current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'Completa el traspaso desde la función de inventario'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_transfer_history BEFORE UPDATE OR DELETE ON public.inventory_transfers FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_history();
CREATE FUNCTION public.guard_transfer_items() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.inventory_transfers WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.transfer_id ELSE NEW.transfer_id END FOR UPDATE;
  IF v_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Solo se pueden editar productos en un traspaso en borrador'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND NEW.transfer_id<>OLD.transfer_id THEN RAISE EXCEPTION 'No se puede cambiar el traspaso'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_transfer_items BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_transfer_items FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_items();

-- The movement trigger is the only place that changes stock (the old RPC
-- also changed stock, which could apply the same movement twice).
CREATE OR REPLACE FUNCTION public.apply_inventory_movement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inventory public.product_inventory;
  v_cost public.inventory_costs;
  v_delta numeric;
BEGIN
  IF NEW.quantity <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.product_id::text || NEW.warehouse_id::text, 0));
  SELECT * INTO v_inventory FROM public.product_inventory
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
      AND location_id IS NOT DISTINCT FROM NEW.location_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.product_inventory(product_id, warehouse_id, location_id, quantity)
      VALUES (NEW.product_id, NEW.warehouse_id, NEW.location_id, 0) RETURNING * INTO v_inventory;
  END IF;
  SELECT * INTO v_cost FROM public.inventory_costs WHERE inventory_id = v_inventory.id;
  v_delta := CASE WHEN NEW.movement_type IN ('PURCHASE','RETURN_IN','TRANSFER_IN','ADJUSTMENT_IN','INITIAL_STOCK') THEN NEW.quantity ELSE -NEW.quantity END;
  IF v_delta < 0 AND v_inventory.quantity - v_inventory.reserved_quantity < NEW.quantity THEN
    RAISE EXCEPTION 'Inventario disponible insuficiente';
  END IF;
  IF v_delta > 0 THEN
    INSERT INTO public.inventory_costs VALUES (
      v_inventory.id,
      CASE WHEN v_inventory.quantity = 0 THEN NEW.unit_cost
        WHEN v_cost.average_cost IS NULL OR NEW.unit_cost IS NULL THEN NULL
        ELSE (v_inventory.quantity*v_cost.average_cost + NEW.quantity*NEW.unit_cost)/(v_inventory.quantity+NEW.quantity) END,
      CASE WHEN v_inventory.quantity = 0 THEN NEW.original_unit_cost
        WHEN v_cost.original_average_cost IS NULL OR NEW.original_unit_cost IS NULL THEN NULL
        ELSE (v_inventory.quantity*v_cost.original_average_cost + NEW.quantity*NEW.original_unit_cost)/(v_inventory.quantity+NEW.quantity) END
    ) ON CONFLICT (inventory_id) DO UPDATE SET average_cost = EXCLUDED.average_cost, original_average_cost = EXCLUDED.original_average_cost;
  END IF;
  UPDATE public.product_inventory SET quantity = quantity + v_delta, updated_at = now() WHERE id = v_inventory.id;
  RETURN NEW;
END;
$$;

-- Preserve the old signature for existing callers; priced entries use a new RPC.
CREATE OR REPLACE FUNCTION public.process_inventory_movement(
  p_product_id uuid, p_warehouse_id uuid, p_movement_type public.inventory_movement_type,
  p_quantity numeric, p_reference_type varchar DEFAULT NULL, p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL, p_created_by uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden registrar movimientos'; END IF;
  INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
    VALUES(p_product_id,p_warehouse_id,p_movement_type,p_quantity,p_reference_type,p_reference_id,p_notes,auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.receive_inventory(p_product_id uuid, p_warehouse_id uuid, p_movement_type public.inventory_movement_type,
  p_quantity numeric, p_unit_cost numeric, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden registrar entradas'; END IF;
  IF p_movement_type NOT IN ('PURCHASE','INITIAL_STOCK','ADJUSTMENT_IN') OR p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Entrada o costo inválido';
  END IF;
  INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,notes,created_by)
    VALUES(p_product_id,p_warehouse_id,p_movement_type,p_quantity,p_unit_cost,p_unit_cost,p_notes,auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.set_inventory_cost(p_inventory_id uuid, p_unit_cost numeric, p_original_unit_cost numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden configurar costos'; END IF;
  IF p_unit_cost IS NULL OR p_original_unit_cost IS NULL OR p_unit_cost < 0 OR p_original_unit_cost < 0 THEN RAISE EXCEPTION 'Costo inválido'; END IF;
  PERFORM 1 FROM public.product_inventory WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente'; END IF;
  INSERT INTO public.inventory_costs VALUES(p_inventory_id,p_unit_cost,p_original_unit_cost)
    ON CONFLICT(inventory_id) DO UPDATE SET average_cost=EXCLUDED.average_cost, original_average_cost=EXCLUDED.original_average_cost;
END;
$$;
CREATE OR REPLACE FUNCTION public.process_inventory_transfer(p_transfer_id uuid, p_created_by uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_transfer public.inventory_transfers; v_item record; v_cost public.inventory_costs;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden completar traspasos'; END IF;
  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND OR v_transfer.status <> 'DRAFT' THEN RAISE EXCEPTION 'El traspaso debe estar en borrador'; END IF;
  IF v_transfer.source_warehouse_id=v_transfer.destination_warehouse_id THEN RAISE EXCEPTION 'Selecciona almacenes diferentes'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id) THEN RAISE EXCEPTION 'Traspaso vacío'; END IF;
  -- Deterministic lock order for opposite-direction transfers.
  PERFORM 1 FROM public.warehouses WHERE id IN (v_transfer.source_warehouse_id,v_transfer.destination_warehouse_id) ORDER BY id FOR UPDATE;
  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id ORDER BY product_id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text || v_transfer.source_warehouse_id::text,0));
    SELECT c.* INTO v_cost FROM public.inventory_costs c JOIN public.product_inventory i ON i.id=c.inventory_id
      WHERE i.product_id=v_item.product_id AND i.warehouse_id=v_transfer.source_warehouse_id AND i.location_id IS NULL;
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN RAISE EXCEPTION 'Captura el precio interno de cada producto'; END IF;
    IF v_cost.original_average_cost IS NULL OR v_cost.average_cost IS NULL THEN RAISE EXCEPTION 'Configura el costo del inventario de origen antes de traspasar'; END IF;
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.source_warehouse_id,'TRANSFER_OUT',v_item.quantity,v_cost.average_cost,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.destination_warehouse_id,'TRANSFER_IN',v_item.quantity,v_item.unit_price,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
  END LOOP;
  UPDATE public.inventory_transfers SET status='COMPLETED',completed_at=now() WHERE id=p_transfer_id;
  RETURN true;
END;
$$;

-- Price from the selected list; costs are captured only when stock leaves.
CREATE FUNCTION public.guard_priced_order_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.sales_orders; v_price numeric;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END FOR UPDATE;
  IF v_order.inventory_posted_at IS NOT NULL OR v_order.status='CANCELLED' THEN RAISE EXCEPTION 'El pedido ya no permite modificar productos'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND NEW.order_id<>OLD.order_id THEN RAISE EXCEPTION 'No se puede cambiar el pedido de un producto'; END IF;
  IF NEW.quantity <= 0 OR NEW.unit_price < 0 THEN RAISE EXCEPTION 'Cantidad o precio inválido'; END IF;
  IF v_order.price_list_id IS NOT NULL THEN
    SELECT amount INTO v_price FROM public.product_prices WHERE product_id=NEW.product_id AND price_list_id=v_order.price_list_id
      AND valid_to IS NULL AND valid_from <= now();
    IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio en la lista seleccionada'; END IF;
    -- Preserve the actual agreed price when only the quantity changes.
    IF TG_OP='INSERT' THEN NEW.unit_price := v_price;
    ELSIF NEW.product_id<>OLD.product_id THEN NEW.unit_price := v_price;
    ELSIF NEW.unit_price<>OLD.unit_price THEN RAISE EXCEPTION 'El precio acordado no se puede modificar'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a_guard_priced_order_item BEFORE INSERT OR UPDATE OR DELETE ON public.sales_order_items FOR EACH ROW EXECUTE FUNCTION public.guard_priced_order_item();

CREATE FUNCTION public.post_order_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item record; v_cost public.inventory_costs;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NOT NEW.inventory_tracking_enabled OR NEW.inventory_posted_at IS NOT NULL OR NEW.status IN ('SHIPPED','DELIVERED') THEN RAISE EXCEPTION 'Crea el pedido en pendiente'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.inventory_tracking_enabled IS DISTINCT FROM OLD.inventory_tracking_enabled THEN RAISE EXCEPTION 'No se puede cambiar el seguimiento del inventario'; END IF;
  IF NOT OLD.inventory_tracking_enabled THEN RETURN NEW; END IF;
  IF NEW.inventory_posted_at IS DISTINCT FROM OLD.inventory_posted_at THEN RAISE EXCEPTION 'La fecha de salida se registra automáticamente'; END IF;
  IF OLD.status='CANCELLED' AND NEW.status<>'CANCELLED' THEN RAISE EXCEPTION 'Un pedido cancelado no puede reabrirse'; END IF;
  IF OLD.inventory_posted_at IS NOT NULL THEN
    IF NEW.warehouse_id IS DISTINCT FROM OLD.warehouse_id OR NEW.price_list_id IS DISTINCT FROM OLD.price_list_id THEN RAISE EXCEPTION 'No se puede cambiar el almacén o lista después de la salida'; END IF;
    IF NEW.status NOT IN ('SHIPPED','DELIVERED','CANCELLED') THEN RAISE EXCEPTION 'El inventario ya salió; cancela para reintegrarlo'; END IF;
  ELSIF EXISTS(SELECT 1 FROM public.sales_order_items WHERE order_id=OLD.id) AND NEW.price_list_id IS DISTINCT FROM OLD.price_list_id THEN
    RAISE EXCEPTION 'La lista debe seleccionarse antes de agregar productos';
  END IF;
  IF NEW.status IN ('SHIPPED','DELIVERED') AND OLD.inventory_posted_at IS NULL THEN
    IF NEW.warehouse_id IS NULL THEN RAISE EXCEPTION 'Selecciona el almacén de salida'; END IF;
    IF NEW.payment_type='CREDITO' AND NEW.credit_approval_status<>'APPROVED' THEN RAISE EXCEPTION 'Autoriza el crédito antes de dar salida'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.sales_order_items WHERE order_id=NEW.id) THEN RAISE EXCEPTION 'Pedido vacío'; END IF;
    FOR v_item IN SELECT * FROM public.sales_order_items WHERE order_id=NEW.id ORDER BY product_id LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text || NEW.warehouse_id::text,0));
      SELECT c.* INTO v_cost FROM public.inventory_costs c JOIN public.product_inventory i ON i.id=c.inventory_id
        WHERE i.product_id=v_item.product_id AND i.warehouse_id=NEW.warehouse_id AND i.location_id IS NULL;
      IF v_cost.average_cost IS NULL OR v_cost.original_average_cost IS NULL THEN RAISE EXCEPTION 'Configura los costos de inventario antes de dar salida'; END IF;
      INSERT INTO public.sales_item_costs VALUES(v_item.id,v_cost.average_cost,v_cost.original_average_cost);
      INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
        VALUES(v_item.product_id,NEW.warehouse_id,'SALE',v_item.quantity,v_cost.average_cost,v_cost.original_average_cost,'sales_order',NEW.id,auth.uid());
    END LOOP;
    NEW.inventory_posted_at := now();
  ELSIF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' AND OLD.inventory_posted_at IS NOT NULL THEN
    FOR v_item IN SELECT i.*,c.unit_cost,c.original_unit_cost FROM public.sales_order_items i JOIN public.sales_item_costs c ON c.item_id=i.id WHERE i.order_id=NEW.id ORDER BY i.product_id LOOP
      INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
        VALUES(v_item.product_id,OLD.warehouse_id,'RETURN_IN',v_item.quantity,v_item.unit_cost,v_item.original_unit_cost,'sales_order_cancel',NEW.id,auth.uid());
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_order_inventory BEFORE INSERT OR UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.post_order_inventory();

-- Invoker views respect the admin-only cost policies.
CREATE VIEW public.inventory_valuation WITH (security_invoker=true) AS
SELECT i.id AS inventory_id,i.product_id,i.warehouse_id,i.quantity,p.code,p.name,w.name AS warehouse_name,
  c.average_cost,c.original_average_cost,i.quantity*c.average_cost AS inventory_value
FROM public.product_inventory i JOIN public.products p ON p.id=i.product_id JOIN public.warehouses w ON w.id=i.warehouse_id
LEFT JOIN public.inventory_costs c ON c.inventory_id=i.id WHERE i.location_id IS NULL AND public.is_inventory_admin();
CREATE VIEW public.sales_margins WITH (security_invoker=true) AS
SELECT o.id AS order_id,o.created_by AS agent_id,o.warehouse_id,w.name AS warehouse_name,o.status,
  o.inventory_posted_at AS sold_at,o.amount_paid,o.total_amount,i.id AS item_id,p.code,p.name,i.quantity,i.unit_price,i.subtotal,
  c.unit_cost,c.original_unit_cost,
  i.subtotal-i.quantity*c.unit_cost AS warehouse_margin,
  i.quantity*(c.unit_cost-c.original_unit_cost) AS upstream_margin,
  i.subtotal-i.quantity*c.original_unit_cost AS gross_profit
FROM public.sales_orders o JOIN public.sales_order_items i ON i.order_id=o.id JOIN public.products p ON p.id=i.product_id
LEFT JOIN public.sales_item_costs c ON c.item_id=i.id LEFT JOIN public.warehouses w ON w.id=o.warehouse_id
WHERE o.inventory_posted_at IS NOT NULL AND o.status IN ('SHIPPED','DELIVERED') AND public.is_inventory_admin();
GRANT SELECT ON public.inventory_valuation,public.sales_margins TO authenticated;
CREATE FUNCTION public.create_priced_order(p_payload jsonb) RETURNS public.sales_orders
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.sales_orders; v_item jsonb; v_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN ('ADMIN','AGENT')) INTO v_staff;
  IF jsonb_array_length(p_payload->'items')=0 THEN RAISE EXCEPTION 'Pedido vacío'; END IF;
  IF v_staff AND ((p_payload->>'warehouse_id') IS NULL OR (p_payload->>'price_list_id') IS NULL) THEN RAISE EXCEPTION 'Selecciona almacén y lista de precios'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_branches WHERE id=(p_payload->>'branch_id')::uuid AND customer_id=(p_payload->>'customer_id')::uuid) THEN RAISE EXCEPTION 'Sucursal inválida'; END IF;
  INSERT INTO public.sales_orders(customer_id,created_by,total_amount,shipping_address,branch_id,warehouse_id,price_list_id,payment_type,credit_term_days,credit_approval_status,credit_approved_by)
  VALUES((p_payload->>'customer_id')::uuid,auth.uid(),0,p_payload->>'shipping_address',(p_payload->>'branch_id')::uuid,
    CASE WHEN v_staff THEN (p_payload->>'warehouse_id')::uuid END,CASE WHEN v_staff THEN (p_payload->>'price_list_id')::uuid END,
    COALESCE(p_payload->>'payment_type','CONTADO'),(p_payload->>'credit_term_days')::integer,
    CASE WHEN p_payload->>'payment_type'='CREDITO' THEN CASE WHEN v_staff THEN 'APPROVED' ELSE 'PENDING' END ELSE 'NOT_REQUESTED' END,
    CASE WHEN v_staff AND p_payload->>'payment_type'='CREDITO' THEN auth.uid() END) RETURNING * INTO v_order;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    INSERT INTO public.sales_order_items(order_id,product_id,quantity,unit_price,subtotal)
    VALUES(v_order.id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,0);
  END LOOP;
  SELECT * INTO v_order FROM public.sales_orders WHERE id=v_order.id;
  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.create_priced_order(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_priced_order(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.receive_inventory(uuid,uuid,public.inventory_movement_type,numeric,numeric,text),
  public.set_inventory_cost(uuid,numeric,numeric),public.is_inventory_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_inventory(uuid,uuid,public.inventory_movement_type,numeric,numeric,text),
  public.set_inventory_cost(uuid,numeric,numeric),public.is_inventory_admin() TO authenticated;
