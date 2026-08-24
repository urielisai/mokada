-- Give all agents read access to customers, branches, and fiscal profiles
-- so they can create sales orders for any customer.

CREATE POLICY "Agents can select customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Agents can select customer_branches"
  ON public.customer_branches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Agents can select customer_fiscal_profiles"
  ON public.customer_fiscal_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );
