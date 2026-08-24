CREATE TYPE public.sales_order_status AS ENUM ('PENDING', 'VALIDATING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TABLE public.sales_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  status public.sales_order_status DEFAULT 'PENDING'::public.sales_order_status NOT NULL,
  total_amount numeric(15, 2) NOT NULL,
  shipping_cost numeric(15, 2) DEFAULT 0,
  estimated_delivery_date date,
  admin_comments text,
  shipping_address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.sales_order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(15, 2) NOT NULL,
  subtotal numeric(15, 2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- Set up Realtime for sales_orders
-- We need to add it to the publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;

-- RLS Policies for sales_orders

-- 1. Admins can do everything
CREATE POLICY "Admins can do everything on sales_orders"
  ON public.sales_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'ADMIN'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 2. Agents can view all orders
CREATE POLICY "Agents can view all sales_orders"
  ON public.sales_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 3. Agents can insert orders
CREATE POLICY "Agents can insert sales_orders"
  ON public.sales_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 4. Customers can view their own orders
CREATE POLICY "Customers can view their own sales_orders"
  ON public.sales_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = sales_orders.customer_id
      AND customers.auth_user_id = auth.uid()
    )
  );

-- 5. Customers can insert their own orders
CREATE POLICY "Customers can insert their own sales_orders"
  ON public.sales_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = sales_orders.customer_id
      AND customers.auth_user_id = auth.uid()
    )
  );

-- RLS Policies for sales_order_items

-- 1. Admins can do everything
CREATE POLICY "Admins can do everything on sales_order_items"
  ON public.sales_order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'ADMIN'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 2. Agents can view all order items
CREATE POLICY "Agents can view all sales_order_items"
  ON public.sales_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 3. Agents can insert order items
CREATE POLICY "Agents can insert sales_order_items"
  ON public.sales_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- 4. Customers can view their own order items
CREATE POLICY "Customers can view their own sales_order_items"
  ON public.sales_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      JOIN public.customers ON customers.id = sales_orders.customer_id
      WHERE sales_orders.id = sales_order_items.order_id
      AND customers.auth_user_id = auth.uid()
    )
  );

-- 5. Customers can insert their own order items
CREATE POLICY "Customers can insert their own sales_order_items"
  ON public.sales_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      JOIN public.customers ON customers.id = sales_orders.customer_id
      WHERE sales_orders.id = sales_order_items.order_id
      AND customers.auth_user_id = auth.uid()
    )
  );

-- Function to handle updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_orders_updated_at
BEFORE UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION update_sales_orders_updated_at();
