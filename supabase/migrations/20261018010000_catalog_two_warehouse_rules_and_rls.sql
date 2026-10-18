-- Rules for purchase codes (ALM-01) vs sale keys (ALM-02), and lock down catalog access:
-- agents and customers only read sale keys, sale prices and sales-warehouse stock;
-- only admins write catalog data or read purchase codes, costs and purchase stock.

----------------------------------------------------------------------------
-- 1. Stock may only enter a warehouse as the matching item type.
--    Outgoing movements stay allowed so legacy rows can be drained.
----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_movement_item_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_type text;
BEGIN
  IF NEW.movement_type IN ('PURCHASE','RETURN_IN','TRANSFER_IN','ADJUSTMENT_IN','INITIAL_STOCK') THEN
    SELECT warehouse_role INTO v_role FROM public.warehouses WHERE id = NEW.warehouse_id;
    SELECT item_type INTO v_type FROM public.products WHERE id = NEW.product_id;
    IF v_role = 'PURCHASE' AND v_type IS DISTINCT FROM 'PURCHASE' THEN
      RAISE EXCEPTION 'Al almacén de compras solo entran códigos de compra';
    END IF;
    IF v_role = 'SALES' AND v_type IS DISTINCT FROM 'SALE' THEN
      RAISE EXCEPTION 'Al almacén de ventas solo entran claves de venta';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_guard_movement_item_type ON public.inventory_movements;
CREATE TRIGGER a_guard_movement_item_type
  BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_movement_item_type();

----------------------------------------------------------------------------
-- 2. Orders only sell sale keys.
----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_priced_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.sales_orders; v_price numeric; v_staff boolean;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END FOR UPDATE;
  IF v_order.inventory_posted_at IS NOT NULL OR v_order.status IN('SHIPPED','DELIVERED','CANCELLED') THEN RAISE EXCEPTION 'El pedido ya no permite modificar productos'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN('ADMIN','AGENT')) INTO v_staff;
  IF TG_OP='UPDATE' AND NEW.order_id<>OLD.order_id THEN RAISE EXCEPTION 'No se puede cambiar el pedido de un producto'; END IF;
  IF NEW.quantity<=0 OR NEW.quantity::text IN('NaN','Infinity','-Infinity') OR NEW.discount_percent IS NULL OR NEW.discount_percent::text IN('NaN','Infinity','-Infinity') OR NEW.discount_percent NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Cantidad o descuento inválido'; END IF;
  IF TG_OP='INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    IF (SELECT item_type FROM public.products WHERE id=NEW.product_id) IS DISTINCT FROM 'SALE' THEN
      RAISE EXCEPTION 'Solo se pueden vender claves de venta';
    END IF;
    IF v_order.price_list_id IS NOT NULL THEN
      SELECT pp.amount INTO v_price FROM public.product_prices pp JOIN public.price_lists pl ON pl.id=pp.price_list_id
        WHERE pp.product_id=NEW.product_id AND pp.price_list_id=v_order.price_list_id AND pl.is_active AND pp.valid_to IS NULL AND pp.valid_from<=now();
      IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio en la lista seleccionada'; END IF;
    ELSE
      SELECT pp.amount INTO v_price FROM public.product_prices pp JOIN public.price_lists pl ON pl.id=pp.price_list_id
        WHERE pp.product_id=NEW.product_id AND pl.code='PUBLIC' AND pl.is_active AND pp.valid_to IS NULL AND pp.valid_from<=now();
      IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio público de venta'; END IF;
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

----------------------------------------------------------------------------
-- 3. Transfers: purchase code out of ALM-01, linked sale key into ALM-02.
----------------------------------------------------------------------------
ALTER TABLE public.inventory_transfer_items DROP CONSTRAINT IF EXISTS inventory_transfer_items_unique;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_transfer_items_unique
  ON public.inventory_transfer_items (transfer_id, product_id, (COALESCE(destination_product_id, product_id)));

-- Sale key a purchase code goes to: the requested one if it is linked, else the default link.
-- Legacy sale keys still sitting in ALM-01 go to themselves.
CREATE OR REPLACE FUNCTION public.resolve_transfer_destination(p_product_id uuid, p_destination_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text; v_label text; v_dest uuid;
BEGIN
  SELECT item_type, code||': '||name INTO v_type, v_label FROM public.products WHERE id=p_product_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona productos activos'; END IF;
  IF v_type = 'SALE' THEN
    IF p_destination_id IS NOT NULL AND p_destination_id<>p_product_id THEN
      RAISE EXCEPTION 'La clave % solo puede traspasarse a sí misma', v_label;
    END IF;
    RETURN p_product_id;
  END IF;
  IF p_destination_id IS NULL THEN
    SELECT sale_product_id INTO v_dest FROM public.product_sale_links
      WHERE purchase_product_id=p_product_id ORDER BY is_default DESC, created_at LIMIT 1;
    IF v_dest IS NULL THEN RAISE EXCEPTION 'El código % no tiene clave de venta ligada', v_label; END IF;
    RETURN v_dest;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_sale_links WHERE purchase_product_id=p_product_id AND sale_product_id=p_destination_id) THEN
    RAISE EXCEPTION 'La clave de venta elegida no está ligada al código %', v_label;
  END IF;
  RETURN p_destination_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_transfer_destination(uuid, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.save_inventory_transfer(p_payload jsonb, p_transfer_id uuid DEFAULT NULL)
RETURNS public.inventory_transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer public.inventory_transfers;
  v_item record;
  v_source uuid := (p_payload->>'source_warehouse_id')::uuid;
  v_destination uuid := (p_payload->>'destination_warehouse_id')::uuid;
  v_available numeric;
  v_average_cost numeric;
  v_original_average_cost numeric;
  v_product_name text;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden guardar traspasos'; END IF;
  IF v_source IS NULL OR v_destination IS NULL OR v_source=v_destination THEN RAISE EXCEPTION 'Selecciona dos almacenes diferentes'; END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items')=0 THEN
    RAISE EXCEPTION 'Agrega productos al traspaso';
  END IF;
  IF p_transfer_id IS NOT NULL THEN
    SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id=p_transfer_id FOR UPDATE;
    IF NOT FOUND OR v_transfer.status<>'DRAFT' THEN RAISE EXCEPTION 'Solo se pueden editar traspasos en borrador'; END IF;
  END IF;
  PERFORM 1 FROM public.warehouses WHERE id IN(v_source,v_destination) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.warehouses WHERE id IN(v_source,v_destination) AND is_active)<>2
    OR (SELECT warehouse_role FROM public.warehouses WHERE id=v_source) IS DISTINCT FROM 'PURCHASE'
    OR (SELECT warehouse_role FROM public.warehouses WHERE id=v_destination) IS DISTINCT FROM 'SALES' THEN
    RAISE EXCEPTION 'El traspaso debe ir del almacén de compras al de ventas';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_payload->'items') AS x(product_id uuid,destination_product_id uuid,quantity numeric) LOOP
    IF v_item.quantity IS NULL OR v_item.quantity<=0 OR v_item.quantity::text IN('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    v_items := v_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'destination_product_id', public.resolve_transfer_destination(v_item.product_id, v_item.destination_product_id),
      'quantity', v_item.quantity);
  END LOOP;

  IF (SELECT count(*) FROM jsonb_to_recordset(v_items) AS x(product_id uuid,destination_product_id uuid)) <>
     (SELECT count(*) FROM (SELECT DISTINCT product_id,destination_product_id FROM jsonb_to_recordset(v_items) AS x(product_id uuid,destination_product_id uuid)) d) THEN
    RAISE EXCEPTION 'Agrupa los productos repetidos en una sola partida';
  END IF;

  -- One purchase code can feed several sale keys, so availability is checked on the total per code.
  FOR v_item IN SELECT product_id, sum(quantity) AS quantity FROM jsonb_to_recordset(v_items) AS x(product_id uuid,quantity numeric)
    GROUP BY product_id ORDER BY product_id LOOP
    SELECT code||': '||name INTO v_product_name FROM public.products WHERE id=v_item.product_id;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text||v_source::text,0));
    SELECT i.quantity-i.reserved_quantity,c.average_cost,c.original_average_cost
      INTO v_available,v_average_cost,v_original_average_cost
    FROM public.product_inventory i LEFT JOIN public.inventory_costs c ON c.inventory_id=i.id
    WHERE i.product_id=v_item.product_id AND i.warehouse_id=v_source AND i.location_id IS NULL FOR UPDATE OF i;
    IF COALESCE(v_available,0)<v_item.quantity THEN
      RAISE EXCEPTION 'Disponible insuficiente para %. Disponible: %, solicitado: %',v_product_name,COALESCE(v_available,0),v_item.quantity;
    END IF;
    IF v_average_cost IS NULL OR v_original_average_cost IS NULL THEN
      RAISE EXCEPTION 'Falta costo en el almacén de compras para %. Configura sus costos antes del traspaso',v_product_name;
    END IF;
  END LOOP;

  IF p_transfer_id IS NULL THEN
    INSERT INTO public.inventory_transfers(transfer_number,source_warehouse_id,destination_warehouse_id,notes,created_by)
      VALUES(COALESCE(NULLIF(p_payload->>'transfer_number',''),'TR-'||gen_random_uuid()::text),v_source,v_destination,p_payload->>'notes',auth.uid())
      RETURNING * INTO v_transfer;
  ELSE
    UPDATE public.inventory_transfers SET source_warehouse_id=v_source,destination_warehouse_id=v_destination,notes=p_payload->>'notes'
      WHERE id=p_transfer_id RETURNING * INTO v_transfer;
    DELETE FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id;
  END IF;
  INSERT INTO public.inventory_transfer_items(transfer_id,product_id,destination_product_id,quantity,unit_price)
    SELECT v_transfer.id,x.product_id,x.destination_product_id,x.quantity,c.average_cost
    FROM jsonb_to_recordset(v_items) AS x(product_id uuid,destination_product_id uuid,quantity numeric)
    JOIN public.product_inventory i ON i.product_id=x.product_id AND i.warehouse_id=v_source AND i.location_id IS NULL
    JOIN public.inventory_costs c ON c.inventory_id=i.id;
  RETURN v_transfer;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_inventory_transfer(p_transfer_id uuid, p_created_by uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer public.inventory_transfers;
  v_item record;
  v_cost public.inventory_costs;
  v_target uuid;
  v_destination_id uuid;
  v_destination_quantity numeric;
  v_destination_average numeric;
  v_destination_original numeric;
  v_product_name text;
  v_source_name text;
  v_available numeric;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden completar traspasos'; END IF;
  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND OR v_transfer.status<>'DRAFT' THEN RAISE EXCEPTION 'El traspaso debe estar en borrador'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id) THEN RAISE EXCEPTION 'Traspaso vacío'; END IF;
  PERFORM 1 FROM public.warehouses WHERE id IN(v_transfer.source_warehouse_id,v_transfer.destination_warehouse_id) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.warehouses WHERE id IN(v_transfer.source_warehouse_id,v_transfer.destination_warehouse_id) AND is_active)<>2
    OR (SELECT warehouse_role FROM public.warehouses WHERE id=v_transfer.source_warehouse_id) IS DISTINCT FROM 'PURCHASE'
    OR (SELECT warehouse_role FROM public.warehouses WHERE id=v_transfer.destination_warehouse_id) IS DISTINCT FROM 'SALES' THEN
    RAISE EXCEPTION 'El traspaso debe ir del almacén de compras al de ventas';
  END IF;
  SELECT name INTO v_source_name FROM public.warehouses WHERE id=v_transfer.source_warehouse_id;
  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id ORDER BY product_id, destination_product_id LOOP
    -- Drafts saved before this migration have no destination: resolve it now.
    v_target := public.resolve_transfer_destination(v_item.product_id, v_item.destination_product_id);
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text||v_transfer.source_warehouse_id::text,0));
    PERFORM pg_advisory_xact_lock(hashtextextended(v_target::text||v_transfer.destination_warehouse_id::text,0));
    SELECT code||': '||name INTO v_product_name FROM public.products WHERE id=v_item.product_id;
    SELECT quantity-reserved_quantity INTO v_available FROM public.product_inventory
      WHERE product_id=v_item.product_id AND warehouse_id=v_transfer.source_warehouse_id AND location_id IS NULL FOR UPDATE;
    IF COALESCE(v_available,0)<v_item.quantity THEN
      RAISE EXCEPTION 'Disponible insuficiente para % en %. Disponible: %, solicitado: %',v_product_name,v_source_name,COALESCE(v_available,0),v_item.quantity;
    END IF;
    SELECT c.* INTO v_cost FROM public.inventory_costs c JOIN public.product_inventory i ON i.id=c.inventory_id
      WHERE i.product_id=v_item.product_id AND i.warehouse_id=v_transfer.source_warehouse_id AND i.location_id IS NULL;
    IF v_cost.original_average_cost IS NULL OR v_cost.average_cost IS NULL THEN
      RAISE EXCEPTION 'Falta costo en % para %. Configura los costos antes del traspaso',v_source_name,v_product_name;
    END IF;

    SELECT i.id,i.quantity,c.average_cost,c.original_average_cost
      INTO v_destination_id,v_destination_quantity,v_destination_average,v_destination_original
    FROM public.product_inventory i LEFT JOIN public.inventory_costs c ON c.inventory_id=i.id
    WHERE i.product_id=v_target AND i.warehouse_id=v_transfer.destination_warehouse_id AND i.location_id IS NULL FOR UPDATE OF i;
    IF v_destination_id IS NOT NULL AND v_destination_quantity>0
      AND (v_destination_average IS NULL OR v_destination_original IS NULL) THEN
      INSERT INTO public.inventory_costs(inventory_id,average_cost,original_average_cost)
        VALUES(v_destination_id,v_cost.average_cost,v_cost.original_average_cost)
      ON CONFLICT(inventory_id) DO UPDATE SET
        average_cost=COALESCE(inventory_costs.average_cost,EXCLUDED.average_cost),
        original_average_cost=COALESCE(inventory_costs.original_average_cost,EXCLUDED.original_average_cost);
    END IF;

    UPDATE public.inventory_transfer_items SET unit_price=v_cost.average_cost, destination_product_id=v_target WHERE id=v_item.id;
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.source_warehouse_id,'TRANSFER_OUT',v_item.quantity,v_cost.average_cost,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_target,v_transfer.destination_warehouse_id,'TRANSFER_IN',v_item.quantity,v_cost.average_cost,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
  END LOOP;
  UPDATE public.inventory_transfers SET status='COMPLETED',completed_at=now() WHERE id=p_transfer_id;
  RETURN true;
END;
$$;

----------------------------------------------------------------------------
-- 4. Product save RPC: item type and code→key links. The two older overloads
--    had no admin check, so any signed-in user could create or edit products.
----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_or_update_product_full(uuid,varchar,varchar,varchar,text,uuid,uuid,uuid,varchar,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.create_or_update_product_full(uuid,varchar,varchar,varchar,text,uuid,uuid,uuid,varchar,jsonb,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.create_or_update_product_full(uuid,varchar,varchar,varchar,text,uuid,uuid,uuid,varchar,jsonb,jsonb,jsonb,text);

CREATE FUNCTION public.create_or_update_product_full(
  p_product_id uuid, p_code varchar, p_barcode varchar, p_name varchar, p_description text,
  p_brand_id uuid, p_category_id uuid, p_unit_of_measure_id uuid, p_status varchar,
  p_prices jsonb, p_inventory jsonb, p_fitments jsonb DEFAULT NULL, p_image_url text DEFAULT NULL,
  p_item_type text DEFAULT NULL, p_sale_links jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product_id uuid; v_price record; v_inv record; v_fit record; v_link record; v_mode text; v_type text;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden guardar productos'; END IF;
  IF p_item_type IS NOT NULL AND p_item_type NOT IN ('SALE','PURCHASE') THEN RAISE EXCEPTION 'Tipo de producto inválido'; END IF;
  IF p_product_id IS NULL THEN
    INSERT INTO public.products(code,barcode,name,description,brand_id,category_id,unit_of_measure_id,status,image_url,item_type)
      VALUES(p_code,p_barcode,p_name,p_description,p_brand_id,p_category_id,p_unit_of_measure_id,
        coalesce(p_status::public.product_status,'ACTIVE'::public.product_status),p_image_url,coalesce(p_item_type,'SALE'))
      RETURNING id,item_type INTO v_product_id,v_type;
  ELSE
    UPDATE public.products SET code=coalesce(p_code,code),barcode=p_barcode,name=coalesce(p_name,name),
      description=p_description,brand_id=p_brand_id,category_id=p_category_id,
      unit_of_measure_id=p_unit_of_measure_id,status=coalesce(p_status::public.product_status,status),
      image_url=p_image_url,item_type=coalesce(p_item_type,item_type),updated_at=now()
    WHERE id=p_product_id RETURNING id,item_type INTO v_product_id,v_type;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  END IF;

  -- Purchase codes carry cost, not sale prices.
  IF p_prices IS NOT NULL AND v_type='SALE' THEN
    FOR v_price IN SELECT * FROM jsonb_to_recordset(p_prices) AS x(price_list_id uuid,amount numeric) LOOP
      SELECT pricing_mode INTO v_mode FROM public.price_lists WHERE id=v_price.price_list_id;
      IF v_mode IS NULL THEN RAISE EXCEPTION 'Lista de precios inexistente'; END IF;
      IF v_mode='PUBLIC_DISCOUNT' THEN CONTINUE; END IF;
      IF v_price.amount IS NULL THEN
        UPDATE public.product_prices SET valid_to=greatest(now(),valid_from)
        WHERE product_id=v_product_id AND price_list_id=v_price.price_list_id AND valid_to IS NULL;
      ELSE
        IF v_price.amount<=0 THEN RAISE EXCEPTION 'El precio de venta debe ser mayor que cero'; END IF;
        INSERT INTO public.product_prices(product_id,price_list_id,amount,valid_from)
          VALUES(v_product_id,v_price.price_list_id,v_price.amount,now())
        ON CONFLICT(product_id,price_list_id) WHERE valid_to IS NULL
          DO UPDATE SET amount=excluded.amount,updated_at=now();
      END IF;
    END LOOP;
  END IF;

  -- Stock settings only for the warehouse that matches the item type.
  IF p_inventory IS NOT NULL THEN
    FOR v_inv IN SELECT x.* FROM jsonb_to_recordset(p_inventory)
      AS x(warehouse_id uuid,minimum_stock numeric,maximum_stock numeric)
      JOIN public.warehouses w ON w.id=x.warehouse_id
      WHERE (w.warehouse_role='PURCHASE')=(v_type='PURCHASE') LOOP
      IF EXISTS(SELECT 1 FROM public.product_inventory WHERE product_id=v_product_id AND warehouse_id=v_inv.warehouse_id AND location_id IS NULL) THEN
        UPDATE public.product_inventory SET minimum_stock=coalesce(v_inv.minimum_stock,0),
          maximum_stock=v_inv.maximum_stock,updated_at=now()
        WHERE product_id=v_product_id AND warehouse_id=v_inv.warehouse_id AND location_id IS NULL;
      ELSE
        INSERT INTO public.product_inventory(product_id,warehouse_id,minimum_stock,maximum_stock,quantity)
          VALUES(v_product_id,v_inv.warehouse_id,coalesce(v_inv.minimum_stock,0),v_inv.maximum_stock,0);
      END IF;
    END LOOP;
  END IF;

  IF p_fitments IS NOT NULL THEN
    DELETE FROM public.product_fitments WHERE product_id=v_product_id;
    FOR v_fit IN SELECT * FROM jsonb_to_recordset(p_fitments)
      AS x(vehicle_model_id uuid,year_from smallint,year_to smallint,engine varchar,notes text) LOOP
      INSERT INTO public.product_fitments(product_id,vehicle_model_id,year_from,year_to,engine,notes)
        VALUES(v_product_id,v_fit.vehicle_model_id,v_fit.year_from,v_fit.year_to,v_fit.engine,v_fit.notes);
    END LOOP;
  END IF;

  -- Links are edited from the purchase code: the payload replaces the whole set.
  IF p_sale_links IS NOT NULL THEN
    IF v_type<>'PURCHASE' THEN RAISE EXCEPTION 'Las claves de venta se ligan desde el código de compra'; END IF;
    DELETE FROM public.product_sale_links WHERE purchase_product_id=v_product_id
      AND sale_product_id NOT IN (SELECT x.sale_product_id FROM jsonb_to_recordset(p_sale_links) AS x(sale_product_id uuid));
    UPDATE public.product_sale_links SET is_default=false WHERE purchase_product_id=v_product_id;
    FOR v_link IN SELECT * FROM jsonb_to_recordset(p_sale_links) AS x(sale_product_id uuid,is_default boolean) LOOP
      INSERT INTO public.product_sale_links(purchase_product_id,sale_product_id,is_default)
        VALUES(v_product_id,v_link.sale_product_id,coalesce(v_link.is_default,false))
      ON CONFLICT(purchase_product_id,sale_product_id) DO UPDATE SET is_default=EXCLUDED.is_default;
    END LOOP;
    IF NOT EXISTS(SELECT 1 FROM public.product_sale_links WHERE purchase_product_id=v_product_id AND is_default) THEN
      UPDATE public.product_sale_links SET is_default=true
        WHERE id=(SELECT id FROM public.product_sale_links WHERE purchase_product_id=v_product_id ORDER BY created_at LIMIT 1);
    END IF;
  END IF;
  RETURN v_product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_or_update_product_full(uuid,varchar,varchar,varchar,text,uuid,uuid,uuid,varchar,jsonb,jsonb,jsonb,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_update_product_full(uuid,varchar,varchar,varchar,text,uuid,uuid,uuid,varchar,jsonb,jsonb,jsonb,text,text,jsonb) TO authenticated, service_role;

----------------------------------------------------------------------------
-- 5. Row level security.
----------------------------------------------------------------------------
-- Products: everyone signed in reads sale keys; only admins read purchase codes or write.
DROP POLICY IF EXISTS authenticated_active_access ON public.products;
DROP POLICY IF EXISTS products_read ON public.products;
DROP POLICY IF EXISTS products_admin_write ON public.products;
CREATE POLICY products_read ON public.products FOR SELECT TO authenticated
  USING (public.current_user_is_active() AND (item_type='SALE' OR public.is_inventory_admin()));
CREATE POLICY products_admin_write ON public.products TO authenticated
  USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin());

-- Catalog reference data: read for everyone signed in, write for admins.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_prices','price_lists','warehouses','warehouse_locations','product_brands',
    'product_categories','units_of_measure','product_fitments','product_references','product_attributes',
    'attribute_definitions','vehicle_makes','vehicle_models'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_active_access ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_admin_write ON public.%I', t);
    EXECUTE format('CREATE POLICY catalog_read ON public.%I FOR SELECT TO authenticated USING (public.current_user_is_active())', t);
    EXECUTE format('CREATE POLICY catalog_admin_write ON public.%I TO authenticated USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin())', t);
  END LOOP;
  -- Purchasing and import data carry costs: admins only.
  FOREACH t IN ARRAY ARRAY['suppliers','product_suppliers','purchase_orders','purchase_order_items',
    'catalog_staging','catalog_imports','catalog_import_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_active_access ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS purchasing_admin ON public.%I', t);
    EXECUTE format('CREATE POLICY purchasing_admin ON public.%I TO authenticated USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin())', t);
  END LOOP;
END $$;

-- Stock: non-admins only see the sales warehouse.
DROP POLICY IF EXISTS inventory_read ON public.product_inventory;
CREATE POLICY inventory_read ON public.product_inventory FOR SELECT TO authenticated
  USING (public.is_inventory_admin() OR (public.current_user_is_active() AND EXISTS (
    SELECT 1 FROM public.warehouses w WHERE w.id = product_inventory.warehouse_id AND w.warehouse_role = 'SALES')));

----------------------------------------------------------------------------
-- 6. Views run with the caller's permissions, so the policies above apply.
--    New columns go at the end so existing selects keep working.
----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.product_search AS
 SELECT p.id, p.code, p.barcode, p.name, p.description, p.status, p.is_new,
    pb.name AS brand, pc.name AS category,
    COALESCE(array_agg(DISTINCT pr.reference) FILTER (WHERE pr.reference IS NOT NULL), ARRAY[]::character varying[]) AS "references",
    p.image_url,
    p.item_type,
    -- Codes on the other side of the link; empty for non-admins (links are admin-only).
    COALESCE((SELECT array_agg(o.code ORDER BY l.is_default DESC, o.code)
       FROM public.product_sale_links l
       JOIN public.products o ON o.id = CASE WHEN p.item_type='SALE' THEN l.purchase_product_id ELSE l.sale_product_id END
      WHERE (p.item_type='SALE' AND l.sale_product_id=p.id) OR (p.item_type='PURCHASE' AND l.purchase_product_id=p.id)),
      ARRAY[]::character varying[]) AS linked_codes
   FROM public.products p
     LEFT JOIN public.product_brands pb ON pb.id = p.brand_id
     LEFT JOIN public.product_categories pc ON pc.id = p.category_id
     LEFT JOIN public.product_references pr ON pr.product_id = p.id
  GROUP BY p.id, p.code, p.barcode, p.name, p.description, p.status, p.is_new, pb.name, pc.name, p.image_url, p.item_type;

CREATE OR REPLACE VIEW public.inventory_available AS
 SELECT pi.id, pi.product_id, p.code AS product_code, p.name AS product_name,
    pb.name AS product_brand, pc.name AS product_category,
    pi.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
    pi.location_id, wl.code AS location_code, wl.name AS location_name,
    pi.quantity, pi.reserved_quantity, (pi.quantity - pi.reserved_quantity) AS available_quantity,
    pi.minimum_stock, pi.maximum_stock, pi.reorder_point,
    CASE
      WHEN (pi.quantity - pi.reserved_quantity) <= 0 THEN 'OUT_OF_STOCK'
      WHEN pi.reorder_point IS NOT NULL AND (pi.quantity - pi.reserved_quantity) <= pi.reorder_point THEN 'LOW_STOCK'
      ELSE 'AVAILABLE'
    END AS availability_status,
    p.image_url AS product_image,
    p.item_type
   FROM public.product_inventory pi
     JOIN public.products p ON p.id = pi.product_id
     LEFT JOIN public.product_brands pb ON pb.id = p.brand_id
     LEFT JOIN public.product_categories pc ON pc.id = p.category_id
     JOIN public.warehouses w ON w.id = pi.warehouse_id
     LEFT JOIN public.warehouse_locations wl ON wl.id = pi.location_id;

CREATE OR REPLACE VIEW public.product_stock_summary AS
 SELECT p.id AS product_id, p.code, p.name, pb.name AS brand,
    COALESCE(sum(pi.quantity), 0) AS total_quantity,
    COALESCE(sum(pi.reserved_quantity), 0) AS total_reserved,
    COALESCE(sum(pi.quantity - pi.reserved_quantity), 0) AS total_available,
    p.item_type
   FROM public.products p
     LEFT JOIN public.product_brands pb ON pb.id = p.brand_id
     LEFT JOIN public.product_inventory pi ON pi.product_id = p.id
  GROUP BY p.id, p.code, p.name, pb.name, p.item_type;

ALTER VIEW public.product_search SET (security_invoker = true);
ALTER VIEW public.inventory_available SET (security_invoker = true);
ALTER VIEW public.low_stock_products SET (security_invoker = true);
ALTER VIEW public.current_product_prices SET (security_invoker = true);
ALTER VIEW public.product_stock_summary SET (security_invoker = true);

-- Nothing in the catalog is readable without signing in.
REVOKE ALL ON public.product_search, public.inventory_available, public.low_stock_products,
  public.current_product_prices, public.product_stock_summary, public.inventory_valuation,
  public.sales_margins FROM anon;
