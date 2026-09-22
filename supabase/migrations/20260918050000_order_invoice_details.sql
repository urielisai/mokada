ALTER TABLE public.sales_orders
  ADD COLUMN requires_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN fiscal_profile_id uuid REFERENCES public.customer_fiscal_profiles(id),
  ADD COLUMN invoice_payment_form text,
  ADD COLUMN invoice_details jsonb;

CREATE FUNCTION public.capture_order_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile public.customer_fiscal_profiles; v_customer public.customers;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.requires_invoice,NEW.fiscal_profile_id,NEW.invoice_payment_form,NEW.invoice_details,NEW.customer_id)
      IS NOT DISTINCT FROM ROW(OLD.requires_invoice,OLD.fiscal_profile_id,OLD.invoice_payment_form,OLD.invoice_details,OLD.customer_id) THEN RETURN NEW; END IF;
    IF OLD.status IN ('SHIPPED','DELIVERED','CANCELLED') THEN
      RAISE EXCEPTION 'Los datos de facturación no pueden cambiar después del envío o la cancelación';
    END IF;
  END IF;
  IF NOT NEW.requires_invoice THEN
    NEW.fiscal_profile_id:=NULL; NEW.invoice_payment_form:=NULL; NEW.invoice_details:=NULL;
    RETURN NEW;
  END IF;
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
REVOKE ALL ON FUNCTION public.capture_order_invoice() FROM PUBLIC;
CREATE TRIGGER capture_order_invoice BEFORE INSERT OR UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_order_invoice();

-- Keep order creation atomic, including its selected fiscal information.
CREATE OR REPLACE FUNCTION public.create_priced_order(p_payload jsonb) RETURNS public.sales_orders
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.sales_orders; v_item jsonb; v_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN ('ADMIN','AGENT')) INTO v_staff;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Agrega productos al pedido'; END IF;
  IF jsonb_array_length(p_payload->'items')=0 THEN RAISE EXCEPTION 'Pedido vacío'; END IF;
  IF v_staff AND ((p_payload->>'warehouse_id') IS NULL OR (p_payload->>'price_list_id') IS NULL) THEN RAISE EXCEPTION 'Selecciona almacén y lista de precios'; END IF;
  IF v_staff AND (NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=(p_payload->>'warehouse_id')::uuid AND is_active) OR NOT EXISTS(SELECT 1 FROM public.price_lists WHERE id=(p_payload->>'price_list_id')::uuid AND is_active)) THEN RAISE EXCEPTION 'Selecciona almacén y lista de precios activos'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_branches WHERE id=(p_payload->>'branch_id')::uuid AND customer_id=(p_payload->>'customer_id')::uuid) THEN RAISE EXCEPTION 'Sucursal inválida'; END IF;
  INSERT INTO public.sales_orders(customer_id,created_by,total_amount,shipping_address,branch_id,warehouse_id,price_list_id,payment_type,credit_term_days,credit_approval_status,credit_approved_by,warranty_return_id,requires_invoice,fiscal_profile_id,invoice_payment_form)
  VALUES((p_payload->>'customer_id')::uuid,auth.uid(),0,p_payload->>'shipping_address',(p_payload->>'branch_id')::uuid,
    CASE WHEN v_staff THEN (p_payload->>'warehouse_id')::uuid END,CASE WHEN v_staff THEN (p_payload->>'price_list_id')::uuid END,
    COALESCE(p_payload->>'payment_type','CONTADO'),(p_payload->>'credit_term_days')::integer,
    CASE WHEN p_payload->>'payment_type'='CREDITO' THEN CASE WHEN v_staff THEN 'APPROVED' ELSE 'PENDING' END ELSE 'NOT_REQUESTED' END,
    CASE WHEN v_staff AND p_payload->>'payment_type'='CREDITO' THEN auth.uid() END,(p_payload->>'warranty_return_id')::uuid,COALESCE((p_payload->>'requires_invoice')::boolean,false),(p_payload->>'fiscal_profile_id')::uuid,p_payload->>'invoice_payment_form') RETURNING * INTO v_order;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    INSERT INTO public.sales_order_items(order_id,product_id,quantity,unit_price,subtotal,discount_percent,discount_reason)
    VALUES(v_order.id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,0,COALESCE((v_item->>'discount_percent')::numeric,0),v_item->>'discount_reason');
  END LOOP;
  SELECT * INTO v_order FROM public.sales_orders WHERE id=v_order.id;
  RETURN v_order;
END;
$$;
