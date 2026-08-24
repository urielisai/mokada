-- 1. Triggers to recalculate subtotal and total_amount

CREATE OR REPLACE FUNCTION calculate_order_item_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate subtotal before insert or update
  NEW.subtotal = NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_order_item_subtotal
BEFORE INSERT OR UPDATE ON public.sales_order_items
FOR EACH ROW
EXECUTE FUNCTION calculate_order_item_subtotal();


CREATE OR REPLACE FUNCTION recalculate_sales_order_total()
RETURNS TRIGGER AS $$
DECLARE
  order_id_val uuid;
  new_total numeric(15,2);
BEGIN
  -- Determine the affected order_id
  IF TG_OP = 'DELETE' THEN
    order_id_val = OLD.order_id;
  ELSE
    order_id_val = NEW.order_id;
  END IF;

  -- Calculate the new total from all items belonging to the order
  SELECT COALESCE(SUM(subtotal), 0) INTO new_total
  FROM public.sales_order_items
  WHERE order_id = order_id_val;

  -- Update the parent sales_order
  UPDATE public.sales_orders
  SET total_amount = new_total
  WHERE id = order_id_val;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_sales_order_total
AFTER INSERT OR UPDATE OR DELETE ON public.sales_order_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_sales_order_total();


-- 2. RLS Policies for UPDATE and DELETE on sales_order_items

-- Customers can UPDATE their own order items
CREATE POLICY "Customers can update their own sales_order_items"
  ON public.sales_order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      JOIN public.customers ON customers.id = sales_orders.customer_id
      WHERE sales_orders.id = sales_order_items.order_id
      AND customers.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      JOIN public.customers ON customers.id = sales_orders.customer_id
      WHERE sales_orders.id = sales_order_items.order_id
      AND customers.auth_user_id = auth.uid()
    )
  );

-- Customers can DELETE their own order items
CREATE POLICY "Customers can delete their own sales_order_items"
  ON public.sales_order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      JOIN public.customers ON customers.id = sales_orders.customer_id
      WHERE sales_orders.id = sales_order_items.order_id
      AND customers.auth_user_id = auth.uid()
    )
  );

-- Agents can DELETE order items (they already have an UPDATE policy from previous migration)
CREATE POLICY "Agents can delete sales_order_items"
  ON public.sales_order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 3. We also need to give Customers permission to UPDATE the sales_orders table
-- Even though the trigger runs as the current user, it needs UPDATE permission on sales_orders
-- unless the function is set to SECURITY DEFINER. Let's make the function SECURITY DEFINER instead.
-- (This is safer than giving full UPDATE access on sales_orders to customers).

ALTER FUNCTION recalculate_sales_order_total() SECURITY DEFINER;
