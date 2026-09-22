-- A 100% automatic discount would produce an invalid zero sale price.
ALTER TABLE public.price_lists ADD CONSTRAINT derived_discount_below_full_price
  CHECK (pricing_mode <> 'PUBLIC_DISCOUNT' OR discount_percentage < 100);
