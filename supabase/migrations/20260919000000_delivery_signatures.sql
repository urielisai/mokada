CREATE TABLE public.order_delivery_receipts (
  order_id uuid PRIMARY KEY REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  signed_by_name text NOT NULL CHECK(length(trim(signed_by_name)) BETWEEN 2 AND 120),
  signature_path text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE public.order_delivery_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_receipts_visible ON public.order_delivery_receipts FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.sales_orders WHERE id=order_id));
GRANT SELECT ON public.order_delivery_receipts TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('delivery-signatures','delivery-signatures',false,1048576,ARRAY['image/png']);
CREATE POLICY delivery_signature_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='delivery-signatures' AND (storage.foldername(name))[1]=auth.uid()::text
  AND EXISTS(SELECT 1 FROM public.sales_orders o WHERE o.id::text=(storage.foldername(name))[2] AND o.status='SHIPPED')
  AND EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active AND user_type IN ('ADMIN','AGENT'))
);
CREATE POLICY delivery_signature_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='delivery-signatures' AND EXISTS(
    SELECT 1 FROM public.order_delivery_receipts r WHERE r.signature_path=name
      AND EXISTS(SELECT 1 FROM public.sales_orders o WHERE o.id=r.order_id))
);
CREATE POLICY delivery_signature_cleanup ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='delivery-signatures' AND (storage.foldername(name))[1]=auth.uid()::text
  AND NOT EXISTS(SELECT 1 FROM public.order_delivery_receipts r WHERE r.signature_path=name)
);

CREATE FUNCTION public.require_delivery_receipt() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status='DELIVERED' AND OLD.status IS DISTINCT FROM 'DELIVERED'
    AND NOT EXISTS(SELECT 1 FROM public.order_delivery_receipts WHERE order_id=NEW.id) THEN
    RAISE EXCEPTION 'Captura la firma de recibido antes de marcar el pedido como entregado';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER require_delivery_receipt BEFORE UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.require_delivery_receipt();

CREATE FUNCTION public.confirm_order_delivery(p_order_id uuid,p_signed_by_name text,p_signature_path text)
RETURNS public.sales_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.sales_orders; v_name text:=trim(p_signed_by_name); v_result public.sales_orders;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles
    WHERE auth_user_id=auth.uid() AND is_active AND user_type IN ('ADMIN','AGENT')) THEN
    RAISE EXCEPTION 'Solo el personal activo puede confirmar entregas';
  END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status<>'SHIPPED' THEN RAISE EXCEPTION 'Solo se puede confirmar un pedido enviado'; END IF;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Captura el nombre de quien recibe'; END IF;
  IF p_signature_path IS NULL OR p_signature_path NOT LIKE auth.uid()::text||'/'||p_order_id::text||'/%'
    OR p_signature_path NOT LIKE '%.png'
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='delivery-signatures' AND name=p_signature_path) THEN
    RAISE EXCEPTION 'Captura una firma válida para este pedido';
  END IF;
  INSERT INTO public.order_delivery_receipts(order_id,signed_by_name,signature_path,recorded_by)
    VALUES(p_order_id,v_name,p_signature_path,auth.uid());
  UPDATE public.sales_orders SET status='DELIVERED' WHERE id=p_order_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_order_delivery(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_delivery(uuid,text,text) TO authenticated;
