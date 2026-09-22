-- Migration: Transfer Pricing
-- Permite asignar un precio de venta a los productos al momento de traspasarlos
-- del almacén principal al secundario/de venta.

-- 1. Agregar unit_price a los ítems del traspaso
ALTER TABLE public.inventory_transfer_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(14, 2);

-- 2. Actualizar la función process_inventory_transfer para registrar precios de venta automáticamente
CREATE OR REPLACE FUNCTION public.process_inventory_transfer(
  p_transfer_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer record;
  v_item record;
  v_target_price_list_id uuid;
BEGIN
  -- Obtener el traspaso y bloquearlo
  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Transfer is already completed';
  END IF;

  -- Buscar la lista de precios vinculada al almacén destino, o en su defecto la lista de precios principal
  SELECT price_list_id INTO v_target_price_list_id
  FROM public.warehouses
  WHERE id = v_transfer.destination_warehouse_id;

  IF v_target_price_list_id IS NULL THEN
    SELECT id INTO v_target_price_list_id FROM public.price_lists ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Procesar cada ítem
  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    -- Salida del almacén origen
    PERFORM public.process_inventory_movement(
      v_item.product_id,
      v_transfer.source_warehouse_id,
      'TRANSFER_OUT'::public.inventory_movement_type,
      v_item.quantity,
      'inventory_transfer',
      v_transfer.id,
      'Traspaso a ' || v_transfer.destination_warehouse_id,
      p_created_by
    );

    -- Entrada al almacén destino
    PERFORM public.process_inventory_movement(
      v_item.product_id,
      v_transfer.destination_warehouse_id,
      'TRANSFER_IN'::public.inventory_movement_type,
      v_item.quantity,
      'inventory_transfer',
      v_transfer.id,
      'Traspaso desde ' || v_transfer.source_warehouse_id,
      p_created_by
    );

    -- Registrar/actualizar precio de venta si el ítem tiene un precio asignado
    IF v_target_price_list_id IS NOT NULL AND v_item.unit_price IS NOT NULL AND v_item.unit_price > 0 THEN
      INSERT INTO public.product_prices (product_id, price_list_id, amount, valid_from)
      VALUES (v_item.product_id, v_target_price_list_id, v_item.unit_price, now())
      ON CONFLICT (product_id, price_list_id) WHERE valid_to IS NULL
      DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();
    END IF;
  END LOOP;

  -- Marcar como completado
  UPDATE public.inventory_transfers
  SET status = 'COMPLETED', completed_at = now()
  WHERE id = p_transfer_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_inventory_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_inventory_transfer TO service_role;
