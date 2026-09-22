-- Save headers and lines together. Failed edits leave the original draft intact.
CREATE FUNCTION public.save_inventory_transfer(p_payload jsonb, p_transfer_id uuid DEFAULT NULL)
RETURNS public.inventory_transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer public.inventory_transfers;
  v_item record;
  v_source uuid := (p_payload->>'source_warehouse_id')::uuid;
  v_destination uuid := (p_payload->>'destination_warehouse_id')::uuid;
  v_available numeric;
  v_product_name text;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden guardar traspasos'; END IF;
  IF v_source IS NULL OR v_destination IS NULL OR v_source=v_destination THEN RAISE EXCEPTION 'Selecciona dos almacenes diferentes'; END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Agrega productos al traspaso'; END IF;
  IF jsonb_array_length(p_payload->'items')=0 THEN RAISE EXCEPTION 'Agrega productos al traspaso'; END IF;
  IF p_transfer_id IS NOT NULL THEN
    SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id=p_transfer_id FOR UPDATE;
    IF NOT FOUND OR v_transfer.status<>'DRAFT' THEN RAISE EXCEPTION 'Solo se pueden editar traspasos en borrador'; END IF;
  END IF;
  PERFORM 1 FROM public.warehouses WHERE id IN(v_source,v_destination) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.warehouses WHERE id IN(v_source,v_destination) AND is_active)<>2 THEN RAISE EXCEPTION 'Selecciona almacenes activos'; END IF;
  IF (SELECT count(*) FROM jsonb_to_recordset(p_payload->'items') AS x(product_id uuid)) <>
     (SELECT count(DISTINCT product_id) FROM jsonb_to_recordset(p_payload->'items') AS x(product_id uuid)) THEN RAISE EXCEPTION 'Agrupa los productos repetidos en una sola partida'; END IF;
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_payload->'items') AS x(product_id uuid,quantity numeric,unit_price numeric) ORDER BY product_id LOOP
    IF v_item.quantity IS NULL OR v_item.quantity<=0 OR v_item.quantity::text IN('NaN','Infinity','-Infinity') OR
       v_item.unit_price IS NULL OR v_item.unit_price<0 OR v_item.unit_price::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Cantidad o precio interno inválido'; END IF;
    SELECT code || ': ' || name INTO v_product_name FROM public.products WHERE id=v_item.product_id AND status='ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona productos activos'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text || v_source::text,0));
    SELECT quantity-reserved_quantity INTO v_available FROM public.product_inventory
      WHERE product_id=v_item.product_id AND warehouse_id=v_source AND location_id IS NULL FOR UPDATE;
    IF COALESCE(v_available,0)<v_item.quantity THEN RAISE EXCEPTION 'Disponible insuficiente para %. Disponible: %, solicitado: %',v_product_name,COALESCE(v_available,0),v_item.quantity; END IF;
  END LOOP;
  IF p_transfer_id IS NULL THEN
    INSERT INTO public.inventory_transfers(transfer_number,source_warehouse_id,destination_warehouse_id,notes,created_by)
      VALUES(COALESCE(NULLIF(p_payload->>'transfer_number',''),'TR-'||gen_random_uuid()::text),v_source,v_destination,p_payload->>'notes',auth.uid()) RETURNING * INTO v_transfer;
  ELSE
    UPDATE public.inventory_transfers SET source_warehouse_id=v_source,destination_warehouse_id=v_destination,notes=p_payload->>'notes'
      WHERE id=p_transfer_id RETURNING * INTO v_transfer;
    DELETE FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id;
  END IF;
  INSERT INTO public.inventory_transfer_items(transfer_id,product_id,quantity,unit_price)
    SELECT v_transfer.id,x.product_id,x.quantity,x.unit_price FROM jsonb_to_recordset(p_payload->'items') AS x(product_id uuid,quantity numeric,unit_price numeric);
  RETURN v_transfer;
END;
$$;
REVOKE ALL ON FUNCTION public.save_inventory_transfer(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_inventory_transfer(jsonb,uuid) TO authenticated;

-- One row per product/warehouse without a bin. NULL in the original unique
-- constraint did not prevent duplicates; ambiguous stock must not be used.
CREATE UNIQUE INDEX IF NOT EXISTS product_inventory_warehouse_unlocated_unique
  ON public.product_inventory(product_id,warehouse_id) WHERE location_id IS NULL;

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['product_inventory','inventory_costs','product_prices','warehouses','inventory_transfers','inventory_transfer_items'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_table) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',v_table);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_inventory_transfer(p_transfer_id uuid, p_created_by uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_transfer public.inventory_transfers; v_item record; v_cost public.inventory_costs; v_product_name text; v_source_name text; v_available numeric;
BEGIN
  IF NOT public.is_inventory_admin() THEN RAISE EXCEPTION 'Solo administradores pueden completar traspasos'; END IF;
  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND OR v_transfer.status <> 'DRAFT' THEN RAISE EXCEPTION 'El traspaso debe estar en borrador'; END IF;
  IF v_transfer.source_warehouse_id=v_transfer.destination_warehouse_id THEN RAISE EXCEPTION 'Selecciona almacenes diferentes'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id) THEN RAISE EXCEPTION 'Traspaso vacío'; END IF;
  -- Deterministic lock order for opposite-direction transfers.
  PERFORM 1 FROM public.warehouses WHERE id IN (v_transfer.source_warehouse_id,v_transfer.destination_warehouse_id) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.warehouses WHERE id IN(v_transfer.source_warehouse_id,v_transfer.destination_warehouse_id) AND is_active)<>2 THEN RAISE EXCEPTION 'Selecciona almacenes activos'; END IF;
  SELECT name INTO v_source_name FROM public.warehouses WHERE id=v_transfer.source_warehouse_id;
  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id=p_transfer_id ORDER BY product_id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id::text || v_transfer.source_warehouse_id::text,0));
    SELECT code || ': ' || name INTO v_product_name FROM public.products WHERE id=v_item.product_id;
    SELECT quantity-reserved_quantity INTO v_available FROM public.product_inventory WHERE product_id=v_item.product_id AND warehouse_id=v_transfer.source_warehouse_id AND location_id IS NULL FOR UPDATE;
    IF COALESCE(v_available,0)<v_item.quantity THEN RAISE EXCEPTION 'Disponible insuficiente para % en %. Disponible: %, solicitado: %',v_product_name,v_source_name,COALESCE(v_available,0),v_item.quantity; END IF;
    SELECT c.* INTO v_cost FROM public.inventory_costs c JOIN public.product_inventory i ON i.id=c.inventory_id
      WHERE i.product_id=v_item.product_id AND i.warehouse_id=v_transfer.source_warehouse_id AND i.location_id IS NULL;
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN RAISE EXCEPTION 'Captura el precio interno de cada producto'; END IF;
    IF v_cost.original_average_cost IS NULL OR v_cost.average_cost IS NULL THEN RAISE EXCEPTION 'Falta costo en % para %. Configura los costos de este producto antes de completar el traspaso',v_source_name,v_product_name; END IF;
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.source_warehouse_id,'TRANSFER_OUT',v_item.quantity,v_cost.average_cost,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
    INSERT INTO public.inventory_movements(product_id,warehouse_id,movement_type,quantity,unit_cost,original_unit_cost,reference_type,reference_id,created_by)
      VALUES(v_item.product_id,v_transfer.destination_warehouse_id,'TRANSFER_IN',v_item.quantity,v_item.unit_price,v_cost.original_average_cost,'inventory_transfer',p_transfer_id,auth.uid());
  END LOOP;
  UPDATE public.inventory_transfers SET status='COMPLETED',completed_at=now() WHERE id=p_transfer_id;
  RETURN true;
END;
$$;
