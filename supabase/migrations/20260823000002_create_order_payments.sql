CREATE TYPE public.payment_method AS ENUM ('CASH', 'TRANSFER', 'CARD');
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Add amount_paid to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN amount_paid numeric(15, 2) DEFAULT 0 NOT NULL;

CREATE TABLE public.sales_order_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
  amount numeric(15, 2) NOT NULL,
  payment_method public.payment_method NOT NULL,
  evidence_path text,
  status public.payment_status DEFAULT 'PENDING'::public.payment_status NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  approved_by uuid REFERENCES auth.users(id),
  comments text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger to keep amount_paid in sync
CREATE OR REPLACE FUNCTION public.update_sales_order_amount_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'APPROVED' THEN
      UPDATE public.sales_orders SET amount_paid = amount_paid + NEW.amount WHERE id = NEW.order_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'APPROVED' AND NEW.status = 'APPROVED' THEN
      UPDATE public.sales_orders SET amount_paid = amount_paid + NEW.amount WHERE id = NEW.order_id;
    ELSIF OLD.status = 'APPROVED' AND NEW.status != 'APPROVED' THEN
      UPDATE public.sales_orders SET amount_paid = amount_paid - OLD.amount WHERE id = NEW.order_id;
    ELSIF OLD.status = 'APPROVED' AND NEW.status = 'APPROVED' AND OLD.amount != NEW.amount THEN
      UPDATE public.sales_orders SET amount_paid = amount_paid - OLD.amount + NEW.amount WHERE id = NEW.order_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED' THEN
      UPDATE public.sales_orders SET amount_paid = amount_paid - OLD.amount WHERE id = OLD.order_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_sales_order_amount_paid_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales_order_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_sales_order_amount_paid();

-- Enable RLS
ALTER TABLE public.sales_order_payments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can do everything on order_payments"
  ON public.sales_order_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'ADMIN'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- Agents can view all payments
CREATE POLICY "Agents can view all order_payments"
  ON public.sales_order_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- Agents can insert cash payments (usually auto-approved, handled by app logic)
CREATE POLICY "Agents can insert order_payments"
  ON public.sales_order_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.auth_user_id = auth.uid()
      AND user_profiles.user_type = 'AGENT'::public.user_profile_type
      AND user_profiles.is_active = true
    )
  );

-- Customers can view their own payments
CREATE POLICY "Customers can view their own order_payments"
  ON public.sales_order_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
      JOIN public.customers c ON so.customer_id = c.id
      WHERE so.id = sales_order_payments.order_id
      AND c.auth_user_id = auth.uid()
    )
  );

-- Customers can insert payments for their own orders
CREATE POLICY "Customers can insert order_payments"
  ON public.sales_order_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
      JOIN public.customers c ON so.customer_id = c.id
      WHERE so.id = order_id
      AND c.auth_user_id = auth.uid()
    )
  );

-- Set up bucket for payment evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-evidence', 'payment-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access to evidence
CREATE POLICY "Public read access on payment-evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-evidence');

-- Authenticated users can upload evidence
CREATE POLICY "Auth users can upload payment-evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-evidence');

-- Admins and agents can update/delete evidence
CREATE POLICY "Staff can manage payment-evidence"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'payment-evidence'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.auth_user_id = auth.uid()
    AND user_profiles.user_type IN ('ADMIN'::public.user_profile_type, 'AGENT'::public.user_profile_type)
  )
);
