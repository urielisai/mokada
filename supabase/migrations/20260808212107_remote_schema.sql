-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION IF EXISTS pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_import_item_status') THEN
    CREATE TYPE public.catalog_import_item_status AS ENUM ('PENDING', 'PROCESSED', 'SKIPPED', 'ERROR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_import_status') THEN
    CREATE TYPE public.catalog_import_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
    CREATE TYPE public.inventory_movement_type AS ENUM ('PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'INITIAL_STOCK');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
    CREATE TYPE public.product_status AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
    CREATE TYPE public.purchase_order_status AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
    CREATE TYPE public.reservation_status AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
    delta NUMERIC(14,3);
    current_quantity NUMERIC(14,3);
    inventory_id UUID;
BEGIN

    IF NEW.movement_type IN (
        'PURCHASE',
        'RETURN_IN',
        'TRANSFER_IN',
        'ADJUSTMENT_IN',
        'INITIAL_STOCK'
    ) THEN
        delta := NEW.quantity;
    ELSE
        delta := -NEW.quantity;
    END IF;


    SELECT
        id,
        quantity
    INTO
        inventory_id,
        current_quantity
    FROM public.product_inventory
    WHERE product_id = NEW.product_id
      AND warehouse_id = NEW.warehouse_id
      AND location_id IS NOT DISTINCT FROM NEW.location_id
    FOR UPDATE;


    IF inventory_id IS NULL THEN

        IF delta < 0 THEN
            RAISE EXCEPTION
                'Insufficient inventory for product % in warehouse %',
                NEW.product_id,
                NEW.warehouse_id;
        END IF;

        INSERT INTO public.product_inventory (
            product_id,
            warehouse_id,
            location_id,
            quantity
        )
        VALUES (
            NEW.product_id,
            NEW.warehouse_id,
            NEW.location_id,
            delta
        );

    ELSE

        IF current_quantity + delta < 0 THEN
            RAISE EXCEPTION
                'Insufficient inventory for product %. Current: %, requested movement: %',
                NEW.product_id,
                current_quantity,
                NEW.quantity;
        END IF;

        UPDATE public.product_inventory
        SET
            quantity = quantity + delta,
            updated_at = NOW()
        WHERE id = inventory_id;

    END IF;


    RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.apply_inventory_movement() TO anon;

GRANT ALL ON FUNCTION public.apply_inventory_movement() TO authenticated;

GRANT ALL ON FUNCTION public.apply_inventory_movement() TO service_role;

CREATE OR REPLACE FUNCTION public.protect_inventory_quantity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
        IF current_user NOT IN (
            'postgres',
            'service_role'
        ) THEN
            RAISE EXCEPTION
                'Inventory quantity must be changed through inventory movements';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.protect_inventory_quantity() TO anon;

GRANT ALL ON FUNCTION public.protect_inventory_quantity() TO authenticated;

GRANT ALL ON FUNCTION public.protect_inventory_quantity() TO service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

CREATE TABLE IF NOT EXISTS public.attribute_definitions (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code        character varying(100)   NOT NULL,
  name        character varying(150)   NOT NULL,
  data_type   character varying(30)    NOT NULL,
  unit        character varying(50),
  description text,
  is_active   boolean                  DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attribute_definitions_code_unique') THEN
    ALTER TABLE public.attribute_definitions ADD CONSTRAINT attribute_definitions_code_unique UNIQUE (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attribute_definitions_pkey') THEN
    ALTER TABLE public.attribute_definitions ADD CONSTRAINT attribute_definitions_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attribute_definitions_type_check') THEN
    ALTER TABLE public.attribute_definitions ADD CONSTRAINT attribute_definitions_type_check CHECK
    (data_type::text = ANY (ARRAY['STRING'::character varying, 'INTEGER'::character varying, 'DECIMAL'::character varying, 'BOOLEAN'::character varying, 'DATE'::character varying,
    'JSON'::character varying]::text[]));
  END IF;
END $$;

GRANT ALL ON public.attribute_definitions TO anon;

GRANT ALL ON public.attribute_definitions TO authenticated;

GRANT ALL ON public.attribute_definitions TO service_role;

CREATE TRIGGER trg_attribute_definitions_updated_at
  BEFORE UPDATE ON public.attribute_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_import_items (
  id                uuid                              DEFAULT gen_random_uuid() NOT NULL,
  catalog_import_id uuid                              NOT NULL,
  product_id        uuid,
  row_number        integer,
  source_data       jsonb,
  normalized_data   jsonb,
  status            public.catalog_import_item_status DEFAULT 'PENDING'::public.catalog_import_item_status NOT NULL,
  error_message     text,
  created_at        timestamp with time zone          DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_import_items_pkey') THEN
    ALTER TABLE public.catalog_import_items ADD CONSTRAINT catalog_import_items_pkey PRIMARY KEY (id);
  END IF;
END $$;

GRANT ALL ON public.catalog_import_items TO anon;

GRANT ALL ON public.catalog_import_items TO authenticated;

GRANT ALL ON public.catalog_import_items TO service_role;

CREATE INDEX IF NOT EXISTS idx_catalog_import_items_import ON public.catalog_import_items (catalog_import_id);

CREATE INDEX IF NOT EXISTS idx_catalog_import_items_product ON public.catalog_import_items (product_id);

CREATE TABLE IF NOT EXISTS public.catalog_imports (
  id                uuid                         DEFAULT gen_random_uuid() NOT NULL,
  file_name         text,
  source            character varying(100),
  status            public.catalog_import_status DEFAULT 'PENDING'::public.catalog_import_status NOT NULL,
  total_records     integer                      DEFAULT 0 NOT NULL,
  processed_records integer                      DEFAULT 0 NOT NULL,
  success_records   integer                      DEFAULT 0 NOT NULL,
  error_records     integer                      DEFAULT 0 NOT NULL,
  started_at        timestamp with time zone,
  completed_at      timestamp with time zone,
  created_by        uuid,
  created_at        timestamp with time zone     DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone     DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_imports_created_by_fkey') THEN
    ALTER TABLE public.catalog_imports ADD CONSTRAINT catalog_imports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_imports_pkey') THEN
    ALTER TABLE public.catalog_imports ADD CONSTRAINT catalog_imports_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_import_items_catalog_import_id_fkey') THEN
    ALTER TABLE public.catalog_import_items ADD CONSTRAINT catalog_import_items_catalog_import_id_fkey FOREIGN KEY (catalog_import_id) REFERENCES public.catalog_imports(id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT ALL ON public.catalog_imports TO anon;

GRANT ALL ON public.catalog_imports TO authenticated;

GRANT ALL ON public.catalog_imports TO service_role;

CREATE TRIGGER trg_catalog_imports_updated_at
  BEFORE UPDATE ON public.catalog_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_staging (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  import_id                uuid,
  source_page              integer,
  raw_category             text,
  raw_code                 text,
  raw_brand                text,
  raw_description          text,
  raw_price_public         numeric(14,2),
  raw_price_discount_10    numeric(14,2),
  raw_price_discount_20    numeric(14,2),
  detected_is_new          boolean                  DEFAULT false,
  detected_is_out_of_stock boolean                  DEFAULT false,
  normalized_code          text,
  normalized_brand         text,
  normalized_category      text,
  normalized_data          jsonb,
  confidence               character varying(20),
  status                   character varying(30)    DEFAULT 'PENDING'::character varying,
  error_message            text,
  created_at               timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_staging_confidence_check') THEN
    ALTER TABLE public.catalog_staging ADD CONSTRAINT catalog_staging_confidence_check CHECK (confidence IS NULL OR (confidence::text = ANY (ARRAY['HIGH'::character varying, 'MEDIUM'::character varying, 'LOW'::character varying]::text[])));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_staging_import_id_fkey') THEN
    ALTER TABLE public.catalog_staging ADD CONSTRAINT catalog_staging_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.catalog_imports(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_staging_pkey') THEN
    ALTER TABLE public.catalog_staging ADD CONSTRAINT catalog_staging_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_staging_status_check') THEN
    ALTER TABLE public.catalog_staging ADD CONSTRAINT catalog_staging_status_check CHECK
    (status::text = ANY (ARRAY['PENDING'::character varying, 'READY'::character varying, 'REVIEW'::character varying, 'IMPORTED'::character varying, 'ERROR'::character
    varying]::text[]));
  END IF;
END $$;

GRANT ALL ON public.catalog_staging TO anon;

GRANT ALL ON public.catalog_staging TO authenticated;

GRANT ALL ON public.catalog_staging TO service_role;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id               uuid                           DEFAULT gen_random_uuid() NOT NULL,
  product_id       uuid                           NOT NULL,
  warehouse_id     uuid                           NOT NULL,
  location_id      uuid,
  movement_type    public.inventory_movement_type NOT NULL,
  quantity         numeric(14,3)                  NOT NULL,
  unit_cost        numeric(14,4),
  total_cost       numeric(16,4)                  GENERATED ALWAYS AS ((quantity * COALESCE(unit_cost, (0)::numeric))) STORED,
  reference_type   character varying(50),
  reference_id     uuid,
  reference_number character varying(150),
  notes            text,
  created_by       uuid,
  created_at       timestamp with time zone       DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_cost_check') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_cost_check CHECK (unit_cost IS NULL OR unit_cost >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_created_by_fkey') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_pkey') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_quantity_check') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_quantity_check CHECK (quantity > 0::numeric);
  END IF;
END $$;

GRANT ALL ON public.inventory_movements TO anon;

GRANT ALL ON public.inventory_movements TO authenticated;

GRANT ALL ON public.inventory_movements TO service_role;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON public.inventory_movements (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON public.inventory_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON public.inventory_movements (reference_type, reference_id);

CREATE TRIGGER trg_apply_inventory_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_inventory_movement();

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id             uuid                      DEFAULT gen_random_uuid() NOT NULL,
  product_id     uuid                      NOT NULL,
  warehouse_id   uuid                      NOT NULL,
  location_id    uuid,
  quantity       numeric(14,3)             NOT NULL,
  reference_type character varying(50),
  reference_id   uuid,
  status         public.reservation_status DEFAULT 'ACTIVE'::public.reservation_status NOT NULL,
  expires_at     timestamp with time zone,
  created_by     uuid,
  created_at     timestamp with time zone  DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone  DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_created_by_fkey') THEN
    ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_pkey') THEN
    ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_quantity_check') THEN
    ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_quantity_check CHECK (quantity > 0::numeric);
  END IF;
END $$;

GRANT ALL ON public.inventory_reservations TO anon;

GRANT ALL ON public.inventory_reservations TO authenticated;

GRANT ALL ON public.inventory_reservations TO service_role;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_active ON public.inventory_reservations (product_id, warehouse_id)
  WHERE status = 'ACTIVE'::public.reservation_status;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status ON public.inventory_reservations (status);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_warehouse ON public.inventory_reservations (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product ON public.inventory_reservations (product_id);

CREATE TRIGGER trg_inventory_reservations_updated_at
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  transfer_id uuid                     NOT NULL,
  product_id  uuid                     NOT NULL,
  quantity    numeric(14,3)            NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfer_items_pkey') THEN
    ALTER TABLE public.inventory_transfer_items ADD CONSTRAINT inventory_transfer_items_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfer_items_quantity_check') THEN
    ALTER TABLE public.inventory_transfer_items ADD CONSTRAINT inventory_transfer_items_quantity_check CHECK (quantity > 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfer_items_unique') THEN
    ALTER TABLE public.inventory_transfer_items ADD CONSTRAINT inventory_transfer_items_unique UNIQUE (transfer_id, product_id);
  END IF;
END $$;

GRANT ALL ON public.inventory_transfer_items TO anon;

GRANT ALL ON public.inventory_transfer_items TO authenticated;

GRANT ALL ON public.inventory_transfer_items TO service_role;

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  transfer_number          character varying(100)   NOT NULL,
  source_warehouse_id      uuid                     NOT NULL,
  destination_warehouse_id uuid                     NOT NULL,
  status                   character varying(30)    DEFAULT 'DRAFT'::character varying NOT NULL,
  notes                    text,
  created_by               uuid,
  created_at               timestamp with time zone DEFAULT now() NOT NULL,
  completed_at             timestamp with time zone
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_created_by_fkey') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_number_unique') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_number_unique UNIQUE (transfer_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_pkey') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfer_items_transfer_id_fkey') THEN
    ALTER TABLE public.inventory_transfer_items ADD CONSTRAINT inventory_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.inventory_transfers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_status_check') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_status_check CHECK (status::text = ANY (ARRAY['DRAFT'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying]::text[]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_warehouse_check') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_warehouse_check CHECK (source_warehouse_id <> destination_warehouse_id);
  END IF;
END $$;

GRANT ALL ON public.inventory_transfers TO anon;

GRANT ALL ON public.inventory_transfers TO authenticated;

GRANT ALL ON public.inventory_transfers TO service_role;

CREATE TABLE IF NOT EXISTS public.price_lists (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code                character varying(100)   NOT NULL,
  name                character varying(150)   NOT NULL,
  discount_percentage numeric(5,2)             DEFAULT 0 NOT NULL,
  currency            character(3)             DEFAULT 'MXN'::bpchar NOT NULL,
  is_active           boolean                  DEFAULT true NOT NULL,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_lists_code_unique') THEN
    ALTER TABLE public.price_lists ADD CONSTRAINT price_lists_code_unique UNIQUE (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_lists_discount_check') THEN
    ALTER TABLE public.price_lists ADD CONSTRAINT price_lists_discount_check CHECK (discount_percentage >= 0::numeric AND discount_percentage <= 100::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_lists_pkey') THEN
    ALTER TABLE public.price_lists ADD CONSTRAINT price_lists_pkey PRIMARY KEY (id);
  END IF;
END $$;

GRANT ALL ON public.price_lists TO anon;

GRANT ALL ON public.price_lists TO authenticated;

GRANT ALL ON public.price_lists TO service_role;

CREATE TRIGGER trg_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_attributes (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id   uuid                     NOT NULL,
  attribute_id uuid                     NOT NULL,
  value        jsonb                    NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attributes_attribute_id_fkey') THEN
    ALTER TABLE public.product_attributes ADD CONSTRAINT product_attributes_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attribute_definitions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attributes_pkey') THEN
    ALTER TABLE public.product_attributes ADD CONSTRAINT product_attributes_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attributes_unique') THEN
    ALTER TABLE public.product_attributes ADD CONSTRAINT product_attributes_unique UNIQUE (product_id, attribute_id);
  END IF;
END $$;

GRANT ALL ON public.product_attributes TO anon;

GRANT ALL ON public.product_attributes TO authenticated;

GRANT ALL ON public.product_attributes TO service_role;

CREATE INDEX IF NOT EXISTS idx_product_attributes_attribute ON public.product_attributes (attribute_id);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product ON public.product_attributes (product_id);

CREATE INDEX IF NOT EXISTS idx_product_attributes_value ON public.product_attributes USING gin (VALUE);

CREATE TRIGGER trg_product_attributes_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_brands (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code       character varying(50),
  name       character varying(150)   NOT NULL,
  is_active  boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_brands_name_unique') THEN
    ALTER TABLE public.product_brands ADD CONSTRAINT product_brands_name_unique UNIQUE (name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_brands_pkey') THEN
    ALTER TABLE public.product_brands ADD CONSTRAINT product_brands_pkey PRIMARY KEY (id);
  END IF;
END $$;

GRANT ALL ON public.product_brands TO anon;

GRANT ALL ON public.product_brands TO authenticated;

GRANT ALL ON public.product_brands TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_brands_code ON public.product_brands (code)
  WHERE code IS NOT NULL;

CREATE TRIGGER trg_product_brands_updated_at
  BEFORE UPDATE ON public.product_brands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_categories (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  parent_id   uuid,
  code        character varying(100),
  name        character varying(150)   NOT NULL,
  description text,
  is_active   boolean                  DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_pkey') THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_parent_id_fkey') THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT ALL ON public.product_categories TO anon;

GRANT ALL ON public.product_categories TO authenticated;

GRANT ALL ON public.product_categories TO service_role;

CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON public.product_categories (parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_code ON public.product_categories (code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_parent_name ON public.product_categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_fitments (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id       uuid                     NOT NULL,
  vehicle_model_id uuid                     NOT NULL,
  year_from        smallint,
  year_to          smallint,
  engine           character varying(100),
  transmission     character varying(50),
  "position"       character varying(50),
  side             character varying(30),
  has_abs          boolean,
  notes            text,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_fitments_pkey') THEN
    ALTER TABLE public.product_fitments ADD CONSTRAINT product_fitments_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_fitments_year_from_check') THEN
    ALTER TABLE public.product_fitments ADD CONSTRAINT product_fitments_year_from_check CHECK (year_from IS NULL OR year_from >= 1900 AND year_from <= 2200);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_fitments_year_range_check') THEN
    ALTER TABLE public.product_fitments ADD CONSTRAINT product_fitments_year_range_check CHECK (year_from IS NULL OR year_to IS NULL OR year_to >= year_from);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_fitments_year_to_check') THEN
    ALTER TABLE public.product_fitments ADD CONSTRAINT product_fitments_year_to_check CHECK (year_to IS NULL OR year_to >= 1900 AND year_to <= 2200);
  END IF;
END $$;

GRANT ALL ON public.product_fitments TO anon;

GRANT ALL ON public.product_fitments TO authenticated;

GRANT ALL ON public.product_fitments TO service_role;

CREATE INDEX IF NOT EXISTS idx_product_fitments_product ON public.product_fitments (product_id);

CREATE INDEX IF NOT EXISTS idx_product_fitments_years ON public.product_fitments (year_from, year_to);

CREATE INDEX IF NOT EXISTS idx_product_fitments_vehicle ON public.product_fitments (vehicle_model_id);

CREATE TRIGGER trg_product_fitments_updated_at
  BEFORE UPDATE ON public.product_fitments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_inventory (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id        uuid                     NOT NULL,
  warehouse_id      uuid                     NOT NULL,
  location_id       uuid,
  quantity          numeric(14,3)            DEFAULT 0 NOT NULL,
  reserved_quantity numeric(14,3)            DEFAULT 0 NOT NULL,
  minimum_stock     numeric(14,3)            DEFAULT 0 NOT NULL,
  maximum_stock     numeric(14,3),
  reorder_point     numeric(14,3),
  updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_maximum_check') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_maximum_check CHECK (maximum_stock IS NULL OR maximum_stock >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_minimum_check') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_minimum_check CHECK (minimum_stock >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_pkey') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_quantity_check') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_quantity_check CHECK (quantity >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_reorder_check') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_reorder_check CHECK (reorder_point IS NULL OR reorder_point >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_reserved_check') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_reserved_check CHECK (reserved_quantity >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_reserved_quantity_check') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_reserved_quantity_check CHECK (reserved_quantity <= quantity);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_unique') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_unique UNIQUE (product_id, warehouse_id, location_id);
  END IF;
END $$;

GRANT ALL ON public.product_inventory TO anon;

GRANT ALL ON public.product_inventory TO authenticated;

GRANT ALL ON public.product_inventory TO service_role;

CREATE INDEX IF NOT EXISTS idx_product_inventory_location ON public.product_inventory (location_id);

CREATE INDEX IF NOT EXISTS idx_product_inventory_product ON public.product_inventory (product_id);

CREATE INDEX IF NOT EXISTS idx_product_inventory_warehouse ON public.product_inventory (warehouse_id);

CREATE TRIGGER trg_protect_inventory_quantity
  BEFORE UPDATE OF quantity ON public.product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_inventory_quantity();

CREATE TABLE IF NOT EXISTS public.product_prices (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id    uuid                     NOT NULL,
  price_list_id uuid                     NOT NULL,
  amount        numeric(14,2)            NOT NULL,
  valid_from    timestamp with time zone DEFAULT now() NOT NULL,
  valid_to      timestamp with time zone,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_amount_check') THEN
    ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_amount_check CHECK (amount >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_date_check') THEN
    ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_date_check CHECK (valid_to IS NULL OR valid_to >= valid_from);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_pkey') THEN
    ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_price_list_id_fkey') THEN
    ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES public.price_lists(id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT ALL ON public.product_prices TO anon;

GRANT ALL ON public.product_prices TO authenticated;

GRANT ALL ON public.product_prices TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_current ON public.product_prices (product_id, price_list_id)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_prices_product ON public.product_prices (product_id);

CREATE INDEX IF NOT EXISTS idx_product_prices_price_list ON public.product_prices (price_list_id);

CREATE TRIGGER trg_product_prices_updated_at
  BEFORE UPDATE ON public.product_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_references (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id     uuid                     NOT NULL,
  reference      character varying(150)   NOT NULL,
  reference_type character varying(50)    DEFAULT 'OTHER'::character varying NOT NULL,
  brand_id       uuid,
  notes          text,
  created_at     timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_references_brand_id_fkey') THEN
    ALTER TABLE public.product_references ADD CONSTRAINT product_references_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.product_brands(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_references_pkey') THEN
    ALTER TABLE public.product_references ADD CONSTRAINT product_references_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_references_unique') THEN
    ALTER TABLE public.product_references ADD CONSTRAINT product_references_unique UNIQUE (product_id, reference, reference_type);
  END IF;
END $$;

GRANT ALL ON public.product_references TO anon;

GRANT ALL ON public.product_references TO authenticated;

GRANT ALL ON public.product_references TO service_role;

CREATE INDEX IF NOT EXISTS idx_product_references_reference ON public.product_references (reference);

CREATE INDEX IF NOT EXISTS idx_product_references_product ON public.product_references (product_id);

CREATE TABLE IF NOT EXISTS public.product_suppliers (
  id                     uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id             uuid                     NOT NULL,
  supplier_id            uuid                     NOT NULL,
  supplier_code          character varying(150),
  last_cost              numeric(14,4),
  minimum_order_quantity numeric(14,3),
  lead_time_days         integer,
  is_preferred           boolean                  DEFAULT false NOT NULL,
  created_at             timestamp with time zone DEFAULT now() NOT NULL,
  updated_at             timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_cost_check') THEN
    ALTER TABLE public.product_suppliers ADD CONSTRAINT product_suppliers_cost_check CHECK (last_cost IS NULL OR last_cost >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_lead_time_check') THEN
    ALTER TABLE public.product_suppliers ADD CONSTRAINT product_suppliers_lead_time_check CHECK (lead_time_days IS NULL OR lead_time_days >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_pkey') THEN
    ALTER TABLE public.product_suppliers ADD CONSTRAINT product_suppliers_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_unique') THEN
    ALTER TABLE public.product_suppliers ADD CONSTRAINT product_suppliers_unique UNIQUE (product_id, supplier_id);
  END IF;
END $$;

GRANT ALL ON public.product_suppliers TO anon;

GRANT ALL ON public.product_suppliers TO authenticated;

GRANT ALL ON public.product_suppliers TO service_role;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON public.product_suppliers (product_id);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON public.product_suppliers (supplier_id);

CREATE TRIGGER trg_product_suppliers_updated_at
  BEFORE UPDATE ON public.product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.products (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code               character varying(150)   NOT NULL,
  barcode            character varying(100),
  brand_id           uuid,
  category_id        uuid,
  unit_of_measure_id uuid,
  name               character varying(300),
  description        text,
  raw_description    text,
  status             public.product_status    DEFAULT 'ACTIVE'::public.product_status NOT NULL,
  is_new             boolean                  DEFAULT false NOT NULL,
  is_active          boolean                  DEFAULT true NOT NULL,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code character varying(150),
  ADD COLUMN IF NOT EXISTS barcode character varying(100),
  ADD COLUMN IF NOT EXISTS brand_id uuid,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS unit_of_measure_id uuid,
  ADD COLUMN IF NOT EXISTS name character varying(300),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS raw_description text,
  ADD COLUMN IF NOT EXISTS status public.product_status DEFAULT 'ACTIVE'::public.product_status,
  ADD COLUMN IF NOT EXISTS is_new boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS image_url text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_brand_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.product_brands(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_code_unique') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_code_unique UNIQUE (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_pkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_import_items_product_id_fkey') THEN
    ALTER TABLE public.catalog_import_items ADD CONSTRAINT catalog_import_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_product_id_fkey') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_product_id_fkey') THEN
    ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfer_items_product_id_fkey') THEN
    ALTER TABLE public.inventory_transfer_items ADD CONSTRAINT inventory_transfer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attributes_product_id_fkey') THEN
    ALTER TABLE public.product_attributes ADD CONSTRAINT product_attributes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_fitments_product_id_fkey') THEN
    ALTER TABLE public.product_fitments ADD CONSTRAINT product_fitments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_product_id_fkey') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_product_id_fkey') THEN
    ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_references_product_id_fkey') THEN
    ALTER TABLE public.product_references ADD CONSTRAINT product_references_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_product_id_fkey') THEN
    ALTER TABLE public.product_suppliers ADD CONSTRAINT product_suppliers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT ALL ON public.products TO anon;

GRANT ALL ON public.products TO authenticated;

GRANT ALL ON public.products TO service_role;

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_active ON public.products (is_active);

CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);

CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products (brand_id);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  purchase_order_id uuid                     NOT NULL,
  product_id        uuid                     NOT NULL,
  quantity          numeric(14,3)            NOT NULL,
  received_quantity numeric(14,3)            DEFAULT 0 NOT NULL,
  unit_cost         numeric(14,4)            NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_cost_check') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_cost_check CHECK (unit_cost >= 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_pkey') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_product_id_fkey') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_quantity_check') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_quantity_check CHECK (quantity > 0::numeric);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_received_check') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_received_check CHECK (received_quantity >= 0::numeric AND received_quantity <= quantity);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_unique') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_unique UNIQUE (purchase_order_id, product_id);
  END IF;
END $$;

GRANT ALL ON public.purchase_order_items TO anon;

GRANT ALL ON public.purchase_order_items TO authenticated;

GRANT ALL ON public.purchase_order_items TO service_role;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON public.purchase_order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON public.purchase_order_items (purchase_order_id);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id           uuid                         DEFAULT gen_random_uuid() NOT NULL,
  order_number character varying(100)       NOT NULL,
  supplier_id  uuid                         NOT NULL,
  warehouse_id uuid                         NOT NULL,
  status       public.purchase_order_status DEFAULT 'DRAFT'::public.purchase_order_status NOT NULL,
  ordered_at   timestamp with time zone,
  expected_at  timestamp with time zone,
  received_at  timestamp with time zone,
  notes        text,
  created_by   uuid,
  created_at   timestamp with time zone     DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone     DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_created_by_fkey') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_number_unique') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_number_unique UNIQUE (order_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_pkey') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_purchase_order_id_fkey') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT ALL ON public.purchase_orders TO anon;

GRANT ALL ON public.purchase_orders TO authenticated;

GRANT ALL ON public.purchase_orders TO service_role;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse ON public.purchase_orders (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders (status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders (supplier_id);

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.suppliers (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       character varying(200)   NOT NULL,
  legal_name character varying(250),
  tax_id     character varying(30),
  phone      character varying(50),
  email      character varying(200),
  notes      text,
  is_active  boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_pkey') THEN
    ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_supplier_id_fkey') THEN
    ALTER TABLE public.product_suppliers ADD CONSTRAINT product_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_supplier_id_fkey') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;
  END IF;
END $$;

GRANT ALL ON public.suppliers TO anon;

GRANT ALL ON public.suppliers TO authenticated;

GRANT ALL ON public.suppliers TO service_role;

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers (name);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.units_of_measure (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code            character varying(30)    NOT NULL,
  name            character varying(100)   NOT NULL,
  allows_decimals boolean                  DEFAULT false NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_of_measure_code_unique') THEN
    ALTER TABLE public.units_of_measure ADD CONSTRAINT units_of_measure_code_unique UNIQUE (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_of_measure_name_unique') THEN
    ALTER TABLE public.units_of_measure ADD CONSTRAINT units_of_measure_name_unique UNIQUE (name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_of_measure_pkey') THEN
    ALTER TABLE public.units_of_measure ADD CONSTRAINT units_of_measure_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_unit_of_measure_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_unit_of_measure_id_fkey FOREIGN KEY (unit_of_measure_id) REFERENCES public.units_of_measure(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT ALL ON public.units_of_measure TO anon;

GRANT ALL ON public.units_of_measure TO authenticated;

GRANT ALL ON public.units_of_measure TO service_role;

CREATE TABLE IF NOT EXISTS public.vehicle_makes (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code       character varying(50),
  name       character varying(150)   NOT NULL,
  is_active  boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_makes_name_unique') THEN
    ALTER TABLE public.vehicle_makes ADD CONSTRAINT vehicle_makes_name_unique UNIQUE (name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_makes_pkey') THEN
    ALTER TABLE public.vehicle_makes ADD CONSTRAINT vehicle_makes_pkey PRIMARY KEY (id);
  END IF;
END $$;

GRANT ALL ON public.vehicle_makes TO anon;

GRANT ALL ON public.vehicle_makes TO authenticated;

GRANT ALL ON public.vehicle_makes TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_makes_code ON public.vehicle_makes (code)
  WHERE code IS NOT NULL;

CREATE TRIGGER trg_vehicle_makes_updated_at
  BEFORE UPDATE ON public.vehicle_makes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.vehicle_models (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  make_id    uuid                     NOT NULL,
  name       character varying(150)   NOT NULL,
  generation character varying(100),
  is_active  boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_models_make_id_fkey') THEN
    ALTER TABLE public.vehicle_models ADD CONSTRAINT vehicle_models_make_id_fkey FOREIGN KEY (make_id) REFERENCES public.vehicle_makes(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_models_pkey') THEN
    ALTER TABLE public.vehicle_models ADD CONSTRAINT vehicle_models_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_fitments_vehicle_model_id_fkey') THEN
    ALTER TABLE public.product_fitments ADD CONSTRAINT product_fitments_vehicle_model_id_fkey FOREIGN KEY (vehicle_model_id) REFERENCES public.vehicle_models(id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT ALL ON public.vehicle_models TO anon;

GRANT ALL ON public.vehicle_models TO authenticated;

GRANT ALL ON public.vehicle_models TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_models_unique ON public.vehicle_models (make_id, name, COALESCE(generation, ''::character varying));

CREATE INDEX IF NOT EXISTS idx_vehicle_models_make ON public.vehicle_models (make_id);

CREATE TRIGGER trg_vehicle_models_updated_at
  BEFORE UPDATE ON public.vehicle_models
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  warehouse_id uuid                     NOT NULL,
  parent_id    uuid,
  code         character varying(50)    NOT NULL,
  name         character varying(150)   NOT NULL,
  description  text,
  is_active    boolean                  DEFAULT true NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_locations_pkey') THEN
    ALTER TABLE public.warehouse_locations ADD CONSTRAINT warehouse_locations_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_location_id_fkey') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_location_id_fkey') THEN
    ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_location_id_fkey') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_locations_parent_id_fkey') THEN
    ALTER TABLE public.warehouse_locations ADD CONSTRAINT warehouse_locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.warehouse_locations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_locations_unique') THEN
    ALTER TABLE public.warehouse_locations ADD CONSTRAINT warehouse_locations_unique UNIQUE (warehouse_id, code);
  END IF;
END $$;

GRANT ALL ON public.warehouse_locations TO anon;

GRANT ALL ON public.warehouse_locations TO authenticated;

GRANT ALL ON public.warehouse_locations TO service_role;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_warehouse ON public.warehouse_locations (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_parent ON public.warehouse_locations (parent_id);

CREATE TRIGGER trg_warehouse_locations_updated_at
  BEFORE UPDATE ON public.warehouse_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code        character varying(50)    NOT NULL,
  name        character varying(150)   NOT NULL,
  description text,
  is_active   boolean                  DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_code_unique') THEN
    ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_code_unique UNIQUE (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_pkey') THEN
    ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_warehouse_id_fkey') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_warehouse_id_fkey') THEN
    ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_destination_warehouse_id_fkey') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_destination_warehouse_id_fkey FOREIGN KEY (destination_warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transfers_source_warehouse_id_fkey') THEN
    ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_source_warehouse_id_fkey FOREIGN KEY (source_warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_warehouse_id_fkey') THEN
    ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_warehouse_id_fkey') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_locations_warehouse_id_fkey') THEN
    ALTER TABLE public.warehouse_locations ADD CONSTRAINT warehouse_locations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT ALL ON public.warehouses TO anon;

GRANT ALL ON public.warehouses TO authenticated;

GRANT ALL ON public.warehouses TO service_role;

CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE VIEW public.current_product_prices AS SELECT pp.id,
    pp.product_id,
    p.code AS product_code,
    p.name AS product_name,
    pp.price_list_id,
    pl.code AS price_list_code,
    pl.name AS price_list_name,
    pl.discount_percentage,
    pl.currency,
    pp.amount,
    pp.valid_from
   FROM ((public.product_prices pp
     JOIN public.products p ON ((p.id = pp.product_id)))
     JOIN public.price_lists pl ON ((pl.id = pp.price_list_id)))
  WHERE (pp.valid_to IS NULL);

GRANT ALL ON public.current_product_prices TO anon;

GRANT ALL ON public.current_product_prices TO authenticated;

GRANT ALL ON public.current_product_prices TO service_role;

CREATE VIEW public.inventory_available AS SELECT pi.id,
    pi.product_id,
    p.code AS product_code,
    p.name AS product_name,
    pb.name AS product_brand,
    pc.name AS product_category,
    pi.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    pi.location_id,
    wl.code AS location_code,
    wl.name AS location_name,
    pi.quantity,
    pi.reserved_quantity,
    (pi.quantity - pi.reserved_quantity) AS available_quantity,
    pi.minimum_stock,
    pi.maximum_stock,
    pi.reorder_point,
        CASE
            WHEN ((pi.quantity - pi.reserved_quantity) <= (0)::numeric) THEN 'OUT_OF_STOCK'::text
            WHEN ((pi.reorder_point IS NOT NULL) AND ((pi.quantity - pi.reserved_quantity) <= pi.reorder_point)) THEN 'LOW_STOCK'::text
            ELSE 'AVAILABLE'::text
        END AS availability_status
   FROM (((((public.product_inventory pi
     JOIN public.products p ON ((p.id = pi.product_id)))
     LEFT JOIN public.product_brands pb ON ((pb.id = p.brand_id)))
     LEFT JOIN public.product_categories pc ON ((pc.id = p.category_id)))
     JOIN public.warehouses w ON ((w.id = pi.warehouse_id)))
     LEFT JOIN public.warehouse_locations wl ON ((wl.id = pi.location_id)));

GRANT ALL ON public.inventory_available TO anon;

GRANT ALL ON public.inventory_available TO authenticated;

GRANT ALL ON public.inventory_available TO service_role;

CREATE VIEW public.low_stock_products AS SELECT id,
    product_id,
    product_code,
    product_name,
    product_brand,
    product_category,
    warehouse_id,
    warehouse_code,
    warehouse_name,
    location_id,
    location_code,
    location_name,
    quantity,
    reserved_quantity,
    available_quantity,
    minimum_stock,
    maximum_stock,
    reorder_point,
    availability_status
   FROM public.inventory_available
  WHERE ((reorder_point IS NOT NULL) AND (available_quantity <= reorder_point));

GRANT ALL ON public.low_stock_products TO anon;

GRANT ALL ON public.low_stock_products TO authenticated;

GRANT ALL ON public.low_stock_products TO service_role;

CREATE VIEW public.product_search AS SELECT p.id,
    p.code,
    p.barcode,
    p.name,
    p.description,
    p.status,
    p.is_new,
    pb.name AS brand,
    pc.name AS category,
    COALESCE(array_agg(DISTINCT pr.reference) FILTER (WHERE (pr.reference IS NOT NULL)), ARRAY[]::character varying[]) AS "references"
   FROM (((public.products p
     LEFT JOIN public.product_brands pb ON ((pb.id = p.brand_id)))
     LEFT JOIN public.product_categories pc ON ((pc.id = p.category_id)))
     LEFT JOIN public.product_references pr ON ((pr.product_id = p.id)))
  GROUP BY p.id, p.code, p.barcode, p.name, p.description, p.status, p.is_new, pb.name, pc.name;

GRANT ALL ON public.product_search TO anon;

GRANT ALL ON public.product_search TO authenticated;

GRANT ALL ON public.product_search TO service_role;

CREATE VIEW public.product_stock_summary AS SELECT p.id AS product_id,
    p.code,
    p.name,
    pb.name AS brand,
    COALESCE(sum(pi.quantity), (0)::numeric) AS total_quantity,
    COALESCE(sum(pi.reserved_quantity), (0)::numeric) AS total_reserved,
    COALESCE(sum((pi.quantity - pi.reserved_quantity)), (0)::numeric) AS total_available
   FROM ((public.products p
     LEFT JOIN public.product_brands pb ON ((pb.id = p.brand_id)))
     LEFT JOIN public.product_inventory pi ON ((pi.product_id = p.id)))
  GROUP BY p.id, p.code, p.name, pb.name;

GRANT ALL ON public.product_stock_summary TO anon;

GRANT ALL ON public.product_stock_summary TO authenticated;

GRANT ALL ON public.product_stock_summary TO service_role;
