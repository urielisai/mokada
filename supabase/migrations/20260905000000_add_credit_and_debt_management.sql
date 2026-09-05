-- Migration: Add Credit (8, 15, 21 days) and Branch to sales_orders

-- 1. Add columns to sales_orders
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.customer_branches(id),
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'CONTADO' NOT NULL,
  ADD COLUMN IF NOT EXISTS credit_term_days integer,
  ADD COLUMN IF NOT EXISTS credit_approval_status text DEFAULT 'NOT_REQUESTED' NOT NULL,
  ADD COLUMN IF NOT EXISTS credit_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS credit_approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS due_date date;

-- Add constraints if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_payment_type_check'
  ) THEN
    ALTER TABLE public.sales_orders
      ADD CONSTRAINT sales_orders_payment_type_check
      CHECK (payment_type IN ('CONTADO', 'CREDITO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_credit_term_days_check'
  ) THEN
    ALTER TABLE public.sales_orders
      ADD CONSTRAINT sales_orders_credit_term_days_check
      CHECK (credit_term_days IS NULL OR credit_term_days IN (8, 15, 21));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_credit_approval_status_check'
  ) THEN
    ALTER TABLE public.sales_orders
      ADD CONSTRAINT sales_orders_credit_approval_status_check
      CHECK (credit_approval_status IN ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED'));
  END IF;
END $$;

-- 2. Trigger function to auto-calculate due_date when credit is APPROVED
CREATE OR REPLACE FUNCTION public.handle_sales_order_credit_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.payment_type = 'CREDITO' THEN
    IF (TG_OP = 'INSERT' AND NEW.credit_approval_status = 'APPROVED')
       OR (TG_OP = 'UPDATE' AND OLD.credit_approval_status IS DISTINCT FROM 'APPROVED' AND NEW.credit_approval_status = 'APPROVED') THEN
      NEW.credit_approved_at = COALESCE(NEW.credit_approved_at, now());
      IF NEW.credit_term_days IS NOT NULL THEN
        NEW.due_date = (NEW.credit_approved_at::date + (NEW.credit_term_days || ' days')::interval)::date;
      END IF;
    END IF;
  ELSE
    NEW.credit_approval_status := 'NOT_REQUESTED';
    NEW.credit_term_days := NULL;
    NEW.due_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_sales_order_credit_approval ON public.sales_orders;

CREATE TRIGGER trg_handle_sales_order_credit_approval
BEFORE INSERT OR UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_sales_order_credit_approval();

-- 3. Add index for faster debt filtering
CREATE INDEX IF NOT EXISTS idx_sales_orders_credit_debt
  ON public.sales_orders (customer_id, branch_id, payment_type, credit_approval_status, due_date);

-- 4. Enable Realtime on sales_orders and sales_order_payments
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_order_payments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
