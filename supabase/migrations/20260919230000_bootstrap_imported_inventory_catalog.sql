-- The imported catalog uses LISTA_100/10/20 and has no warehouses.
-- Reuse its price rows and identifiers before enabling the shared inventory flow.
DO $$
DECLARE
  v_public_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.price_lists WHERE code = 'PUBLIC') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.price_lists WHERE code = 'LISTA_100') THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.warehouses) <> 0
    OR NOT EXISTS (SELECT 1 FROM public.price_lists WHERE code = 'LISTA_10')
    OR NOT EXISTS (SELECT 1 FROM public.price_lists WHERE code = 'LISTA_20')
    OR EXISTS (
      SELECT 1 FROM public.product_prices pp JOIN public.price_lists pl ON pl.id = pp.price_list_id
      WHERE pl.code = 'DISCOUNT_10'
    )
    OR EXISTS (
      SELECT 1 FROM public.sales_orders o JOIN public.price_lists pl ON pl.id = o.price_list_id
      WHERE pl.code = 'DISCOUNT_10'
    ) THEN
    RAISE EXCEPTION 'Revisa los almacenes y listas importadas antes de activar el flujo de inventario';
  END IF;

  UPDATE public.price_lists SET code = 'LEGACY_DISCOUNT_10', name = 'Descuento 10% anterior sin uso', is_active = false
  WHERE code = 'DISCOUNT_10';
  UPDATE public.price_lists SET code = 'PUBLIC', name = 'Precio público', discount_percentage = 0
  WHERE code = 'LISTA_100' RETURNING id INTO v_public_id;
  UPDATE public.price_lists SET code = 'DISCOUNT_10', name = 'Descuento 10%', discount_percentage = 10
  WHERE code = 'LISTA_10';
  UPDATE public.price_lists SET code = 'DISCOUNT_20', name = 'Descuento 20%', discount_percentage = 20
  WHERE code = 'LISTA_20';

  INSERT INTO public.price_lists (code, name, discount_percentage, currency, is_active)
  VALUES ('PRECIO POR MAYORE', 'Precio por mayoreo', 0, 'MXN', true);
  INSERT INTO public.warehouses (code, name, description, is_active, price_list_id)
  VALUES
    ('ALM-01', 'Almacén principal', 'Compras y abastecimiento', true, NULL),
    ('ALM-02', 'Almacén secundario', 'Ventas a clientes', true, v_public_id);
END;
$$;
