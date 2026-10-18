-- Two identities for the same physical part:
--   PURCHASE item: supplier code, lives in the purchase warehouse (ALM-01) at acquisition cost.
--   SALE item: sale key, lives in the sales warehouse (ALM-02) with sale prices.
-- One purchase code can feed several sale keys (e.g. the same belt sold under two lines).
-- Additive only: every existing product stays SALE, so the running app is unaffected.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'SALE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_item_type_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_item_type_check CHECK (item_type IN ('SALE', 'PURCHASE'));
  END IF;
  -- A purchase code and a sale key may be the same text (e.g. B335), so uniqueness is per type.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_code_unique') THEN
    ALTER TABLE public.products DROP CONSTRAINT products_code_unique;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_code_item_type_unique') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_code_item_type_unique UNIQUE (code, item_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_item_type_idx ON public.products (item_type);

CREATE TABLE IF NOT EXISTS public.product_sale_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_sale_links_pair_unique UNIQUE (purchase_product_id, sale_product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_sale_links_one_default
  ON public.product_sale_links (purchase_product_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS product_sale_links_sale_idx
  ON public.product_sale_links (sale_product_id);

CREATE OR REPLACE FUNCTION public.guard_product_sale_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT item_type FROM public.products WHERE id = NEW.purchase_product_id) IS DISTINCT FROM 'PURCHASE' THEN
    RAISE EXCEPTION 'El origen de la liga debe ser un código de compra';
  END IF;
  IF (SELECT item_type FROM public.products WHERE id = NEW.sale_product_id) IS DISTINCT FROM 'SALE' THEN
    RAISE EXCEPTION 'El destino de la liga debe ser una clave de venta';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_product_sale_link ON public.product_sale_links;
CREATE TRIGGER guard_product_sale_link
  BEFORE INSERT OR UPDATE ON public.product_sale_links
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_sale_link();

-- A product cannot switch type once links point at it with the old type.
CREATE OR REPLACE FUNCTION public.guard_product_item_type_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.item_type IS DISTINCT FROM OLD.item_type AND EXISTS (
    SELECT 1 FROM public.product_sale_links WHERE purchase_product_id = OLD.id OR sale_product_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Quita las ligas código/clave antes de cambiar el tipo del producto';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_product_item_type_change ON public.products;
CREATE TRIGGER guard_product_item_type_change
  BEFORE UPDATE OF item_type ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_item_type_change();

ALTER TABLE public.product_sale_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_sale_links_admin ON public.product_sale_links;
CREATE POLICY product_sale_links_admin ON public.product_sale_links
  TO authenticated USING (public.is_inventory_admin()) WITH CHECK (public.is_inventory_admin());
REVOKE ALL ON public.product_sale_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sale_links TO authenticated;
GRANT ALL ON public.product_sale_links TO service_role;

-- Transfers move a purchase code out of ALM-01 and a sale key into ALM-02.
-- NULL keeps the old behaviour (same product on both sides).
ALTER TABLE public.inventory_transfer_items
  ADD COLUMN IF NOT EXISTS destination_product_id uuid REFERENCES public.products(id);
