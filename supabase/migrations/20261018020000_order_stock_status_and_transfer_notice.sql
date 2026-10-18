-- Orders may include sale keys with no stock in the sales warehouse (the part can still be
-- transferred from the purchase warehouse). Tell the order screen which items need a transfer
-- and notify admins once per order, without exposing purchase stock or costs to agents.

-- Stock status of one sale key for an order. Purchase code, quantities and ids of the purchase
-- warehouse are only returned to admins; everyone else gets the status label.
CREATE OR REPLACE FUNCTION public.sale_key_stock_status(p_product_id uuid, p_warehouse_id uuid, p_needed numeric)
RETURNS TABLE(sales_available numeric, missing numeric, status text,
  purchase_product_id uuid, purchase_code text, purchase_available numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sales numeric; v_missing numeric; v_pid uuid; v_code text; v_avail numeric;
  v_admin boolean := public.is_inventory_admin();
BEGIN
  IF NOT public.current_user_is_active() THEN RETURN; END IF;
  SELECT coalesce(sum(i.quantity - i.reserved_quantity), 0) INTO v_sales
  FROM public.product_inventory i JOIN public.warehouses w ON w.id = i.warehouse_id
  WHERE i.product_id = p_product_id AND i.location_id IS NULL AND w.warehouse_role = 'SALES' AND w.is_active
    AND (p_warehouse_id IS NULL OR i.warehouse_id = p_warehouse_id);
  v_missing := greatest(coalesce(p_needed, 0) - v_sales, 0);

  -- Prefer the default code if it covers what is missing, else the code with the most stock.
  SELECT p.id, p.code, coalesce(sum(i.quantity - i.reserved_quantity), 0)
    INTO v_pid, v_code, v_avail
  FROM public.product_sale_links l
  JOIN public.products p ON p.id = l.purchase_product_id
  LEFT JOIN public.product_inventory i ON i.product_id = p.id AND i.location_id IS NULL
    AND i.warehouse_id IN (SELECT id FROM public.warehouses WHERE warehouse_role = 'PURCHASE' AND is_active)
  WHERE l.sale_product_id = p_product_id
  GROUP BY p.id, p.code, l.is_default
  ORDER BY (l.is_default AND coalesce(sum(i.quantity - i.reserved_quantity), 0) >= v_missing) DESC,
    coalesce(sum(i.quantity - i.reserved_quantity), 0) DESC
  LIMIT 1;

  sales_available := v_sales;
  missing := v_missing;
  status := CASE WHEN v_missing = 0 THEN 'OK' WHEN coalesce(v_avail, 0) > 0 THEN 'TRANSFER' ELSE 'NO_STOCK' END;
  IF v_admin THEN
    purchase_product_id := v_pid; purchase_code := v_code; purchase_available := coalesce(v_avail, 0);
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.sale_key_stock_status(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sale_key_stock_status(uuid, uuid, numeric) TO authenticated;

-- Per product of an order. Runs as the caller, so it only answers for orders they can see.
CREATE OR REPLACE FUNCTION public.get_order_stock_status(p_order_id uuid)
RETURNS TABLE(product_id uuid, quantity numeric, sales_available numeric, missing numeric, status text,
  purchase_product_id uuid, purchase_code text, purchase_available numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH o AS (SELECT id, warehouse_id FROM public.sales_orders WHERE id = p_order_id),
  d AS (SELECT i.product_id, sum(i.quantity)::numeric AS qty
        FROM public.sales_order_items i JOIN o ON o.id = i.order_id GROUP BY i.product_id)
  SELECT d.product_id, d.qty, s.sales_available, s.missing, s.status,
         s.purchase_product_id, s.purchase_code, s.purchase_available
  FROM d CROSS JOIN o
  CROSS JOIN LATERAL public.sale_key_stock_status(d.product_id, o.warehouse_id, d.qty) s;
$$;
REVOKE ALL ON FUNCTION public.get_order_stock_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_stock_status(uuid) TO authenticated;

-- One notice per order to admins the first time an item lacks sales-warehouse stock.
-- Never blocks the order: any failure here is swallowed.
CREATE OR REPLACE FUNCTION public.notify_admin_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.sales_orders; v_needed numeric; v_sales numeric; v_has_purchase boolean;
  v_key text; v_customer text;
BEGIN
  BEGIN
    SELECT * INTO v_order FROM public.sales_orders WHERE id = NEW.order_id;
    IF v_order.inventory_posted_at IS NOT NULL OR v_order.status IN ('SHIPPED','DELIVERED','CANCELLED') THEN RETURN NEW; END IF;
    SELECT sum(quantity) INTO v_needed FROM public.sales_order_items WHERE order_id = NEW.order_id AND product_id = NEW.product_id;
    SELECT coalesce(sum(i.quantity - i.reserved_quantity), 0) INTO v_sales
    FROM public.product_inventory i JOIN public.warehouses w ON w.id = i.warehouse_id
    WHERE i.product_id = NEW.product_id AND i.location_id IS NULL AND w.warehouse_role = 'SALES' AND w.is_active
      AND (v_order.warehouse_id IS NULL OR i.warehouse_id = v_order.warehouse_id);
    IF v_sales >= v_needed THEN RETURN NEW; END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.product_sale_links l
      JOIN public.product_inventory i ON i.product_id = l.purchase_product_id AND i.location_id IS NULL
      JOIN public.warehouses w ON w.id = i.warehouse_id AND w.warehouse_role = 'PURCHASE' AND w.is_active
      WHERE l.sale_product_id = NEW.product_id AND i.quantity - i.reserved_quantity > 0
    ) INTO v_has_purchase;
    SELECT code INTO v_key FROM public.products WHERE id = NEW.product_id;
    SELECT name INTO v_customer FROM public.customers WHERE id = v_order.customer_id;

    INSERT INTO public.notifications(recipient_id, title, body, entity_type, entity_id, target_path, event_key, created_by)
    SELECT u.auth_user_id,
      CASE WHEN v_has_purchase THEN 'Pedido requiere traspaso' ELSE 'Pedido sin existencia' END,
      left('El pedido #' || left(NEW.order_id::text, 8) || coalesce(' de ' || v_customer, '') || ' necesita ' ||
        trim_scale(v_needed)::text || ' de ' || coalesce(v_key, 'un producto') || ' y en ventas hay ' || trim_scale(v_sales)::text ||
        CASE WHEN v_has_purchase THEN '. Hay existencia en el almacén principal para traspasar.'
             ELSE '. Tampoco hay existencia en el almacén principal.' END, 2000),
      'sales_orders', NEW.order_id::text, '/orders/' || NEW.order_id::text,
      'order-stock:' || NEW.order_id::text, auth.uid()
    FROM public.user_profiles u
    WHERE u.user_type = 'ADMIN' AND u.is_active
    ON CONFLICT (recipient_id, event_key) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'notify_admin_order_stock: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admin_order_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_admin_order_stock ON public.sales_order_items;
CREATE TRIGGER notify_admin_order_stock
  AFTER INSERT OR UPDATE OF quantity, product_id ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_order_stock();
