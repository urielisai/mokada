-- Notify active administrators when a customer reports a payment.
-- A database trigger covers every payment entry point and keeps the notice
-- tied to the committed payment, rather than to a particular browser flow.
CREATE FUNCTION public.notify_admin_customer_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name text;
BEGIN
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_user_id = NEW.created_by
      AND user_type = 'CUSTOMER'
      AND is_active
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO v_customer_name
  FROM public.sales_orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = NEW.order_id;

  INSERT INTO public.notifications (
    recipient_id, title, body, entity_type, entity_id,
    target_path, event_key, created_by
  )
  SELECT u.auth_user_id,
    'Pago de cliente por revisar',
    left(
      coalesce(v_customer_name, 'Un cliente') || ' registró un pago de $' ||
      NEW.amount::text || ' para el pedido #' || left(NEW.order_id::text, 8) || '.',
      2000
    ),
    'sales_order_payments', NEW.id::text,
    '/orders/' || NEW.order_id::text,
    'customer-payment:' || NEW.id::text,
    NEW.created_by
  FROM public.user_profiles u
  WHERE u.user_type = 'ADMIN' AND u.is_active;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_admin_customer_payment
AFTER INSERT ON public.sales_order_payments
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_customer_payment();

REVOKE ALL ON FUNCTION public.notify_admin_customer_payment() FROM PUBLIC, anon, authenticated;
