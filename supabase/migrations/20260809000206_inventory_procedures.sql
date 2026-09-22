-- Migration: Inventory Procedures
-- Description: Stored procedures to handle inventory movements safely.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
    CREATE TYPE public.inventory_movement_type AS ENUM (
      'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'INITIAL_STOCK'
    );
  END IF;
END $$;

-- 1. Process Inventory Movement
CREATE OR REPLACE FUNCTION public.process_inventory_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity numeric,
  p_reference_type varchar DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movement_id uuid;
  v_qty_change numeric;
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  -- Determine direction
  IF p_movement_type IN ('PURCHASE', 'RETURN_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'INITIAL_STOCK') THEN
    v_qty_change := p_quantity;
  ELSIF p_movement_type IN ('SALE', 'RETURN_OUT', 'TRANSFER_OUT', 'ADJUSTMENT_OUT') THEN
    v_qty_change := -p_quantity;
  ELSE
    RAISE EXCEPTION 'Unknown movement type';
  END IF;

  -- Update or Insert into product_inventory
  IF EXISTS (SELECT 1 FROM public.product_inventory WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id AND location_id IS NULL) THEN
    UPDATE public.product_inventory
    SET 
      quantity = quantity + v_qty_change,
      updated_at = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id AND location_id IS NULL;
  ELSE
    INSERT INTO public.product_inventory (product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_warehouse_id, v_qty_change);
  END IF;

  -- Insert into inventory_movements
  INSERT INTO public.inventory_movements (
    product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by
  ) VALUES (
    p_product_id, p_warehouse_id, p_movement_type, p_quantity, p_reference_type, p_reference_id, p_notes, p_created_by
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;


-- 2. Process Inventory Transfer
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
BEGIN
  -- Get transfer details
  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Transfer is already completed';
  END IF;

  -- Loop through items
  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    -- 1. Transfer Out (Source Warehouse)
    PERFORM public.process_inventory_movement(
      v_item.product_id,
      v_transfer.source_warehouse_id,
      'TRANSFER_OUT'::public.inventory_movement_type,
      v_item.quantity,
      'inventory_transfer',
      v_transfer.id,
      'Traspaso a ' || v_transfer.destination_warehouse_id, -- Note can be improved, but sufficient
      p_created_by
    );

    -- 2. Transfer In (Destination Warehouse)
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
  END LOOP;

  -- Mark transfer as completed
  UPDATE public.inventory_transfers
  SET status = 'COMPLETED', completed_at = now()
  WHERE id = p_transfer_id;

  RETURN true;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.process_inventory_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_inventory_movement TO service_role;

GRANT EXECUTE ON FUNCTION public.process_inventory_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_inventory_transfer TO service_role;
