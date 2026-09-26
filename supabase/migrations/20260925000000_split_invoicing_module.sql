-- 1. Relax the capture_order_invoice trigger so it doesn't fail if fiscal_profile is omitted at checkout.
CREATE OR REPLACE FUNCTION public.capture_order_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile public.customer_fiscal_profiles; v_customer public.customers;
BEGIN
  IF NOT NEW.requires_invoice THEN
    NEW.fiscal_profile_id:=NULL; NEW.invoice_payment_form:=NULL; NEW.invoice_details:=NULL;
    RETURN NEW;
  END IF;

  -- If it requires invoice but no profile is provided, that's fine now, it means they will specify it via notes/module later.
  IF NEW.fiscal_profile_id IS NULL THEN
    NEW.invoice_details:=NULL;
    NEW.invoice_payment_form:=NULL;
    RETURN NEW;
  END IF;

  -- Existing logic if they DO provide it
  SELECT * INTO v_customer FROM public.customers WHERE id=NEW.customer_id;
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active
    AND (user_type IN ('ADMIN','AGENT') OR (user_type='CUSTOMER' AND v_customer.auth_user_id=auth.uid()))) THEN
    RAISE EXCEPTION 'No puedes configurar la facturación de este cliente';
  END IF;
  SELECT * INTO v_profile FROM public.customer_fiscal_profiles
    WHERE id=NEW.fiscal_profile_id AND customer_id=NEW.customer_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona un perfil fiscal activo de este cliente'; END IF;
  IF NEW.invoice_payment_form IS NULL OR NEW.invoice_payment_form NOT IN ('CASH','TRANSFER','CREDIT_CARD','DEBIT_CARD','UNDEFINED') THEN
    RAISE EXCEPTION 'Selecciona la forma de pago para facturación';
  END IF;
  NEW.invoice_details:=jsonb_build_object('customer_name',v_customer.name,'customer_email',v_customer.email,
    'legal_name',v_profile.legal_name,'rfc',v_profile.rfc,'cfdi_use',v_profile.cfdi_use,
    'tax_regime',v_profile.tax_regime,'billing_email',v_profile.billing_email,
    'fiscal_zip_code',v_profile.fiscal_zip_code,'issuer_zip_code','42186','payment_form',NEW.invoice_payment_form);
  RETURN NEW;
END;
$$;

-- 2. Create the invoicing module tables
CREATE TABLE IF NOT EXISTS public.sales_order_invoice_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
    fiscal_profile_id uuid REFERENCES public.customer_fiscal_profiles(id) NOT NULL,
    invoice_payment_form text NOT NULL,
    invoice_details jsonb NOT NULL,
    status text DEFAULT 'PENDING' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sales_order_invoice_request_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_request_id uuid REFERENCES public.sales_order_invoice_requests(id) ON DELETE CASCADE NOT NULL,
    order_item_id uuid REFERENCES public.sales_order_items(id) ON DELETE CASCADE NOT NULL,
    quantity integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.sales_order_invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_invoice_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on invoice requests" ON public.sales_order_invoice_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND user_type = 'ADMIN' AND is_active));
CREATE POLICY "Admins can do everything on invoice request items" ON public.sales_order_invoice_request_items FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND user_type = 'ADMIN' AND is_active));

CREATE POLICY "Agents can view invoice requests" ON public.sales_order_invoice_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND user_type = 'AGENT' AND is_active));
CREATE POLICY "Agents can view invoice request items" ON public.sales_order_invoice_request_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND user_type = 'AGENT' AND is_active));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_invoice_request_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_sales_order_invoice_requests_updated_at BEFORE UPDATE ON public.sales_order_invoice_requests FOR EACH ROW EXECUTE FUNCTION public.update_invoice_request_updated_at();
