-- Customers without a chosen list always start from the public price.
-- Staff orders keep their selected list and item-level negotiated discounts.
CREATE OR REPLACE FUNCTION public.guard_priced_order_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.sales_orders; v_price numeric; v_staff boolean;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END FOR UPDATE;
  IF v_order.inventory_posted_at IS NOT NULL OR v_order.status IN('SHIPPED','DELIVERED','CANCELLED') THEN RAISE EXCEPTION 'El pedido ya no permite modificar productos'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN('ADMIN','AGENT')) INTO v_staff;
  IF TG_OP='UPDATE' AND NEW.order_id<>OLD.order_id THEN RAISE EXCEPTION 'No se puede cambiar el pedido de un producto'; END IF;
  IF NEW.quantity<=0 OR NEW.quantity::text IN('NaN','Infinity','-Infinity') OR NEW.discount_percent IS NULL OR NEW.discount_percent::text IN('NaN','Infinity','-Infinity') OR NEW.discount_percent NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Cantidad o descuento inválido'; END IF;
  IF TG_OP='INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    IF v_order.price_list_id IS NOT NULL THEN
      SELECT pp.amount INTO v_price FROM public.product_prices pp JOIN public.price_lists pl ON pl.id=pp.price_list_id
        WHERE pp.product_id=NEW.product_id AND pp.price_list_id=v_order.price_list_id AND pl.is_active AND pp.valid_to IS NULL AND pp.valid_from<=now();
      IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio en la lista seleccionada'; END IF;
    ELSE
      SELECT pp.amount INTO v_price FROM public.product_prices pp JOIN public.price_lists pl ON pl.id=pp.price_list_id
        WHERE pp.product_id=NEW.product_id AND pl.code='PUBLIC' AND pl.is_active AND pp.valid_to IS NULL AND pp.valid_from<=now();
      IF v_price IS NULL THEN RAISE EXCEPTION 'Producto sin precio público de venta'; END IF;
    END IF;
    NEW.list_unit_price:=v_price;
  ELSE
    NEW.list_unit_price:=OLD.list_unit_price;
  END IF;
  IF NOT v_staff AND (NEW.discount_percent<>0 OR (TG_OP='UPDATE' AND NEW.discount_percent IS DISTINCT FROM OLD.discount_percent)) THEN RAISE EXCEPTION 'Solo el agente o administrador puede acordar descuentos'; END IF;
  IF NEW.discount_percent>0 AND NULLIF(btrim(NEW.discount_reason),'') IS NULL THEN RAISE EXCEPTION 'Captura el motivo del descuento'; END IF;
  IF TG_OP='INSERT' OR NEW.discount_percent IS DISTINCT FROM OLD.discount_percent OR NEW.discount_reason IS DISTINCT FROM OLD.discount_reason THEN NEW.price_adjusted_by:=CASE WHEN NEW.discount_percent>0 THEN auth.uid() END;
  ELSE NEW.price_adjusted_by:=OLD.price_adjusted_by; END IF;
  NEW.unit_price:=round(NEW.list_unit_price*(1-NEW.discount_percent/100),2);
  RETURN NEW;
END;
$$;
