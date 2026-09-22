-- Purchase stock belongs to supply warehouses; customer orders leave sales warehouses.
ALTER TABLE public.warehouses
  ADD COLUMN warehouse_role text NOT NULL DEFAULT 'SALES'
    CHECK (warehouse_role IN ('PURCHASE', 'SALES'));

UPDATE public.warehouses SET warehouse_role = 'PURCHASE' WHERE code = 'ALM-01';
UPDATE public.warehouses SET price_list_id = NULL WHERE warehouse_role = 'PURCHASE';
UPDATE public.warehouses
SET price_list_id = (SELECT id FROM public.price_lists WHERE code = 'PUBLIC')
WHERE warehouse_role = 'SALES' AND price_list_id IS NULL;

ALTER TABLE public.warehouses ADD CONSTRAINT warehouse_pricing_role_check
  CHECK ((warehouse_role = 'PURCHASE' AND price_list_id IS NULL)
      OR (warehouse_role = 'SALES' AND price_list_id IS NOT NULL));

-- The public and wholesale lists are entered by hand. Discount lists follow
-- the public price; their stored rows remain readable by existing order flows.
ALTER TABLE public.price_lists
  ADD COLUMN pricing_mode text NOT NULL DEFAULT 'MANUAL'
    CHECK (pricing_mode IN ('MANUAL', 'PUBLIC_DISCOUNT'));
UPDATE public.price_lists SET pricing_mode = 'PUBLIC_DISCOUNT'
WHERE code IN ('DISCOUNT_10', 'DISCOUNT_20');

-- Zero-valued placeholders were never usable sale prices.
UPDATE public.product_prices SET valid_to = greatest(now(), valid_from)
WHERE valid_to IS NULL AND amount = 0;
ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_positive_amount
  CHECK (amount > 0) NOT VALID;

CREATE FUNCTION public.sync_public_discount_prices(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_public_price numeric;
BEGIN
  SELECT pp.amount INTO v_public_price
  FROM public.product_prices pp JOIN public.price_lists pl ON pl.id = pp.price_list_id
  WHERE pp.product_id = p_product_id AND pl.code = 'PUBLIC' AND pp.valid_to IS NULL;

  IF v_public_price IS NULL THEN
    UPDATE public.product_prices pp SET valid_to = greatest(now(), pp.valid_from)
    FROM public.price_lists pl
    WHERE pp.product_id = p_product_id AND pp.price_list_id = pl.id
      AND pl.pricing_mode = 'PUBLIC_DISCOUNT' AND pp.valid_to IS NULL;
    RETURN;
  END IF;

  INSERT INTO public.product_prices(product_id, price_list_id, amount, valid_from)
  SELECT p_product_id, pl.id, round(v_public_price * (1 - pl.discount_percentage / 100), 2), now()
  FROM public.price_lists pl
  WHERE pl.pricing_mode = 'PUBLIC_DISCOUNT'
    AND round(v_public_price * (1 - pl.discount_percentage / 100), 2) > 0
  ON CONFLICT (product_id, price_list_id) WHERE valid_to IS NULL
  DO UPDATE SET amount = excluded.amount, updated_at = now();
END;
$$;

CREATE FUNCTION public.guard_discount_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_discount numeric; v_public_price numeric;
BEGIN
  SELECT discount_percentage INTO v_discount FROM public.price_lists
  WHERE id = NEW.price_list_id AND pricing_mode = 'PUBLIC_DISCOUNT';
  IF FOUND AND NEW.valid_to IS NULL THEN
    SELECT pp.amount INTO v_public_price
    FROM public.product_prices pp JOIN public.price_lists pl ON pl.id = pp.price_list_id
    WHERE pp.product_id = NEW.product_id AND pl.code = 'PUBLIC' AND pp.valid_to IS NULL;
    IF v_public_price IS NULL THEN RAISE EXCEPTION 'Captura el precio público antes del descuento'; END IF;
    NEW.amount := round(v_public_price * (1 - v_discount / 100), 2);
    IF NEW.amount <= 0 THEN RAISE EXCEPTION 'El precio con descuento debe ser mayor que cero'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_discount_price BEFORE INSERT OR UPDATE ON public.product_prices
FOR EACH ROW EXECUTE FUNCTION public.guard_discount_price();

CREATE FUNCTION public.refresh_discount_prices_from_public()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product_id uuid; v_list_id uuid;
BEGIN
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  v_list_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.price_list_id ELSE NEW.price_list_id END;
  IF EXISTS (SELECT 1 FROM public.price_lists WHERE id = v_list_id AND code = 'PUBLIC') THEN
    PERFORM public.sync_public_discount_prices(v_product_id);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER refresh_discount_prices_from_public
AFTER INSERT OR UPDATE OR DELETE ON public.product_prices
FOR EACH ROW EXECUTE FUNCTION public.refresh_discount_prices_from_public();

CREATE FUNCTION public.refresh_discount_prices_from_list()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product_id uuid;
BEGIN
  IF NEW.pricing_mode = 'PUBLIC_DISCOUNT' THEN
    FOR v_product_id IN SELECT DISTINCT product_id FROM public.product_prices LOOP
      PERFORM public.sync_public_discount_prices(v_product_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refresh_discount_prices_from_list
AFTER UPDATE OF discount_percentage, pricing_mode ON public.price_lists
FOR EACH ROW EXECUTE FUNCTION public.refresh_discount_prices_from_list();

DO $$ DECLARE v_product_id uuid;
BEGIN
  FOR v_product_id IN SELECT DISTINCT product_id FROM public.product_prices LOOP
    PERFORM public.sync_public_discount_prices(v_product_id);
  END LOOP;
END $$;

-- Keep the existing product save transaction, including inventory limits and
-- fitments, but treat empty manual prices as unset instead of saving $0.
CREATE OR REPLACE FUNCTION public.create_or_update_product_full(
  p_product_id uuid, p_code varchar, p_barcode varchar, p_name varchar,
  p_description text, p_brand_id uuid, p_category_id uuid,
  p_unit_of_measure_id uuid, p_status varchar, p_prices jsonb,
  p_inventory jsonb, p_fitments jsonb DEFAULT NULL, p_image_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product_id uuid; v_price record; v_inv record; v_fit record; v_mode text;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden guardar productos'; END IF;
  IF p_product_id IS NULL THEN
    INSERT INTO public.products(code,barcode,name,description,brand_id,category_id,unit_of_measure_id,status,image_url)
      VALUES(p_code,p_barcode,p_name,p_description,p_brand_id,p_category_id,p_unit_of_measure_id,
        coalesce(p_status::public.product_status,'ACTIVE'::public.product_status),p_image_url)
      RETURNING id INTO v_product_id;
  ELSE
    UPDATE public.products SET code=coalesce(p_code,code),barcode=p_barcode,name=coalesce(p_name,name),
      description=p_description,brand_id=p_brand_id,category_id=p_category_id,
      unit_of_measure_id=p_unit_of_measure_id,status=coalesce(p_status::public.product_status,status),
      image_url=p_image_url,updated_at=now()
    WHERE id=p_product_id RETURNING id INTO v_product_id;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  END IF;

  IF p_prices IS NOT NULL THEN
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

  IF p_inventory IS NOT NULL THEN
    FOR v_inv IN SELECT * FROM jsonb_to_recordset(p_inventory)
      AS x(warehouse_id uuid,minimum_stock numeric,maximum_stock numeric) LOOP
      IF EXISTS(SELECT 1 FROM public.product_inventory WHERE product_id=v_product_id AND warehouse_id=v_inv.warehouse_id AND location_id IS NULL) THEN
        UPDATE public.product_inventory SET minimum_stock=v_inv.minimum_stock,
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
  RETURN v_product_id;
END;
$$;

CREATE FUNCTION public.enforce_warehouse_flow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_check boolean;
BEGIN
  IF TG_TABLE_NAME = 'inventory_transfers' THEN
    v_check := TG_OP = 'INSERT';
    IF TG_OP = 'UPDATE' THEN
      v_check := NEW.source_warehouse_id IS DISTINCT FROM OLD.source_warehouse_id
        OR NEW.destination_warehouse_id IS DISTINCT FROM OLD.destination_warehouse_id;
    END IF;
    IF v_check THEN
      IF (SELECT warehouse_role FROM public.warehouses WHERE id=NEW.source_warehouse_id) IS DISTINCT FROM 'PURCHASE'
        OR (SELECT warehouse_role FROM public.warehouses WHERE id=NEW.destination_warehouse_id) IS DISTINCT FROM 'SALES' THEN
        RAISE EXCEPTION 'El traspaso debe ir del almacén de compras al de ventas';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    v_check := TG_OP = 'INSERT';
    IF TG_OP = 'UPDATE' THEN
      v_check := NEW.warehouse_id IS DISTINCT FROM OLD.warehouse_id
        OR (NEW.status IN ('SHIPPED','DELIVERED') AND OLD.inventory_posted_at IS NULL);
    END IF;
    IF NEW.warehouse_id IS NOT NULL AND v_check THEN
      SELECT warehouse_role INTO v_role FROM public.warehouses WHERE id=NEW.warehouse_id;
      IF v_role IS DISTINCT FROM 'SALES' THEN
        RAISE EXCEPTION 'Los pedidos de clientes deben salir de un almacén de ventas';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a_enforce_transfer_warehouse_flow
BEFORE INSERT OR UPDATE ON public.inventory_transfers
FOR EACH ROW EXECUTE FUNCTION public.enforce_warehouse_flow();
CREATE TRIGGER a_enforce_sales_warehouse_flow
BEFORE INSERT OR UPDATE ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_warehouse_flow();

CREATE FUNCTION public.guard_manual_inventory_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.movement_type IN ('PURCHASE','INITIAL_STOCK','ADJUSTMENT_IN') THEN
    IF (SELECT warehouse_role FROM public.warehouses WHERE id=NEW.warehouse_id) IS DISTINCT FROM 'PURCHASE' THEN
      RAISE EXCEPTION 'Las entradas manuales van al almacén de compras; usa un traspaso para ventas';
    END IF;
    IF NEW.unit_cost IS NULL OR NEW.original_unit_cost IS NULL THEN
      RAISE EXCEPTION 'Captura el costo de compra por unidad';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a_guard_manual_inventory_entry
BEFORE INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.guard_manual_inventory_entry();

CREATE OR REPLACE FUNCTION public.receive_inventory(
  p_product_id uuid, p_warehouse_id uuid, p_movement_type public.inventory_movement_type,
  p_quantity numeric, p_unit_cost numeric, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden registrar entradas'; END IF;
  IF (SELECT warehouse_role FROM public.warehouses WHERE id=p_warehouse_id AND is_active) IS DISTINCT FROM 'PURCHASE' THEN
    RAISE EXCEPTION 'Registra las compras en el almacén principal; el de ventas recibe por traspaso';
  END IF;
  IF p_movement_type NOT IN ('PURCHASE','INITIAL_STOCK','ADJUSTMENT_IN') OR p_quantity IS NULL OR p_quantity<=0
    OR p_unit_cost IS NULL OR p_unit_cost<0 THEN RAISE EXCEPTION 'Entrada, cantidad o costo inválido'; END IF;
  INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,notes,created_by)
    VALUES(p_product_id,p_warehouse_id,p_movement_type,p_quantity,p_unit_cost,p_unit_cost,p_notes,auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_inventory_transfer(p_transfer_id uuid, p_created_by uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer public.inventory_transfers;
  v_item record;
  v_cost public.inventory_costs;
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
  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id ORDER BY product_id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text || v_transfer.source_warehouse_id::text,0));
    SELECT code||': '||name INTO v_product_name FROM public.products WHERE id=v_item.product_id;
    SELECT quantity-reserved_quantity INTO v_available FROM public.product_inventory
      WHERE product_id=v_item.product_id AND warehouse_id=v_transfer.source_warehouse_id AND location_id IS NULL FOR UPDATE;
    IF coalesce(v_available,0)<v_item.quantity THEN
      RAISE EXCEPTION 'Disponible insuficiente para % en %. Disponible: %, solicitado: %',v_product_name,v_source_name,coalesce(v_available,0),v_item.quantity;
    END IF;
    SELECT c.* INTO v_cost FROM public.inventory_costs c JOIN public.product_inventory i ON i.id=c.inventory_id
      WHERE i.product_id=v_item.product_id AND i.warehouse_id=v_transfer.source_warehouse_id AND i.location_id IS NULL;
    IF v_cost.original_average_cost IS NULL OR v_cost.average_cost IS NULL THEN
      RAISE EXCEPTION 'Falta costo en % para %. Configura los costos antes del traspaso',v_source_name,v_product_name;
    END IF;
    IF v_item.unit_price IS NULL OR v_item.unit_price<=v_cost.average_cost THEN
      RAISE EXCEPTION 'El precio interno de % debe ser mayor que el costo promedio del origen (%)',v_product_name,v_cost.average_cost;
    END IF;
    SELECT i.quantity,c.average_cost,c.original_average_cost
      INTO v_destination_quantity,v_destination_average,v_destination_original
    FROM public.product_inventory i LEFT JOIN public.inventory_costs c ON c.inventory_id=i.id
    WHERE i.product_id=v_item.product_id AND i.warehouse_id=v_transfer.destination_warehouse_id AND i.location_id IS NULL FOR UPDATE OF i;
    IF v_destination_quantity>0 AND (v_destination_average IS NULL OR v_destination_original IS NULL) THEN
      RAISE EXCEPTION 'Falta costo de existencias anteriores de % en el almacén destino',v_product_name;
    END IF;
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.source_warehouse_id,'TRANSFER_OUT',v_item.quantity,v_cost.average_cost,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.destination_warehouse_id,'TRANSFER_IN',v_item.quantity,v_item.unit_price,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
  END LOOP;
  UPDATE public.inventory_transfers SET status='COMPLETED',completed_at=now() WHERE id=p_transfer_id;
  RETURN true;
END;
$$;
