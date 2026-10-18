-- Agents could read and modify every sales order (policies from 20260823*).
-- Scope them to the routes assigned in "Roles de rutas" (routes.agent_id), the
-- same rule customers and routes already follow (20260928000000/000001).

-- 1. Helper: can the current agent work with an order of this customer/branch?
--    SECURITY DEFINER so the check doesn't recurse through RLS.
CREATE OR REPLACE FUNCTION public.current_agent_can_access_order(p_customer_id uuid, p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.auth_user_id = auth.uid()
      AND up.user_type = 'AGENT'::public.user_profile_type
      AND up.is_active = true
  )
  AND CASE
    WHEN p_branch_id IS NOT NULL THEN EXISTS (
      SELECT 1
      FROM public.customer_branches cb
      JOIN public.routes r ON r.id = cb.route_id
      JOIN public.user_profiles up ON up.id = r.agent_id
      WHERE cb.id = p_branch_id
        AND up.auth_user_id = auth.uid()
    )
    ELSE public.check_agent_customer_access(p_customer_id)
  END;
$$;

REVOKE ALL ON FUNCTION public.current_agent_can_access_order(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_agent_can_access_order(uuid, uuid) TO authenticated;

-- 2. sales_orders
DROP POLICY IF EXISTS "Agents can view all sales_orders" ON public.sales_orders;
CREATE POLICY "Agents can view route sales_orders" ON public.sales_orders
  FOR SELECT USING (public.current_agent_can_access_order(customer_id, branch_id));

DROP POLICY IF EXISTS "Agents can insert sales_orders" ON public.sales_orders;
CREATE POLICY "Agents can insert route sales_orders" ON public.sales_orders
  FOR INSERT WITH CHECK (public.current_agent_can_access_order(customer_id, branch_id));

DROP POLICY IF EXISTS "Agents can update sales_orders" ON public.sales_orders;
CREATE POLICY "Agents can update route sales_orders" ON public.sales_orders
  FOR UPDATE
  USING (public.current_agent_can_access_order(customer_id, branch_id))
  WITH CHECK (public.current_agent_can_access_order(customer_id, branch_id));

-- 3. Child tables: follow the parent order's visibility.
DROP POLICY IF EXISTS "Agents can view all sales_order_items" ON public.sales_order_items;
CREATE POLICY "Agents can view route sales_order_items" ON public.sales_order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_items.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can insert sales_order_items" ON public.sales_order_items;
CREATE POLICY "Agents can insert route sales_order_items" ON public.sales_order_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_items.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can update sales_order_items" ON public.sales_order_items;
CREATE POLICY "Agents can update route sales_order_items" ON public.sales_order_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_items.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can delete sales_order_items" ON public.sales_order_items;
CREATE POLICY "Agents can delete route sales_order_items" ON public.sales_order_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_items.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can view all order_payments" ON public.sales_order_payments;
CREATE POLICY "Agents can view route order_payments" ON public.sales_order_payments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_payments.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can insert order_payments" ON public.sales_order_payments;
CREATE POLICY "Agents can insert route order_payments" ON public.sales_order_payments
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_payments.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can view invoice requests" ON public.sales_order_invoice_requests;
CREATE POLICY "Agents can view route invoice requests" ON public.sales_order_invoice_requests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_invoice_requests.order_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));

DROP POLICY IF EXISTS "Agents can view invoice request items" ON public.sales_order_invoice_request_items;
CREATE POLICY "Agents can view route invoice request items" ON public.sales_order_invoice_request_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sales_order_invoice_requests ir
    JOIN public.sales_orders o ON o.id = ir.order_id
    WHERE ir.id = sales_order_invoice_request_items.invoice_request_id
      AND public.current_agent_can_access_order(o.customer_id, o.branch_id)
  ));
