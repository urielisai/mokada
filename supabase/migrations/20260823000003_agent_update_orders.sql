-- Agents can update orders
CREATE POLICY "Agents can update sales_orders"
  ON public.sales_orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- Agents can update order items
CREATE POLICY "Agents can update sales_order_items"
  ON public.sales_order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );
