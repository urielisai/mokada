DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_person_type') THEN
    CREATE TYPE public.fiscal_person_type AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customers (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  auth_user_id       uuid                     NOT NULL,
  name               text                     NOT NULL,
  email              text                     NOT NULL,
  phone              text                     NOT NULL,
  requires_invoice   boolean                  DEFAULT false NOT NULL,
  is_active          boolean                  DEFAULT true NOT NULL,
  created_by         uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS requires_invoice boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_pkey') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_auth_user_id_unique') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
  ON public.customers (lower(email));

CREATE INDEX idx_customers_active_name
  ON public.customers (is_active, name);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.customer_fiscal_profiles (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id      uuid                     NOT NULL,
  person_type      public.fiscal_person_type DEFAULT 'LEGAL_ENTITY'::public.fiscal_person_type NOT NULL,
  rfc              text                     NOT NULL,
  legal_name       text                     NOT NULL,
  tax_regime       text                     NOT NULL,
  fiscal_zip_code  text                     NOT NULL,
  billing_email    text                     NOT NULL,
  is_default       boolean                  DEFAULT false NOT NULL,
  is_active        boolean                  DEFAULT true NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT customer_fiscal_profiles_rfc_check CHECK (rfc = upper(rfc) AND length(trim(rfc)) > 0),
  CONSTRAINT customer_fiscal_profiles_legal_name_check CHECK (length(trim(legal_name)) > 0),
  CONSTRAINT customer_fiscal_profiles_tax_regime_check CHECK (length(trim(tax_regime)) > 0),
  CONSTRAINT customer_fiscal_profiles_fiscal_zip_code_check CHECK (length(trim(fiscal_zip_code)) > 0),
  CONSTRAINT customer_fiscal_profiles_billing_email_check CHECK (
    billing_email = lower(billing_email)
    AND length(trim(billing_email)) > 0
  )
);

ALTER TABLE public.customer_fiscal_profiles
  ADD CONSTRAINT customer_fiscal_profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_fiscal_profiles
  ADD CONSTRAINT customer_fiscal_profiles_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX customer_fiscal_profiles_customer_rfc_unique
  ON public.customer_fiscal_profiles (customer_id, upper(rfc));

CREATE INDEX idx_customer_fiscal_profiles_customer_active
  ON public.customer_fiscal_profiles (customer_id, is_active);

CREATE TABLE public.customer_branches (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  customer_id           uuid                     NOT NULL,
  name                  text                     NOT NULL,
  manager_name          text,
  phone_primary         text                     NOT NULL,
  phone_secondary       text,
  street                text,
  exterior_number       text,
  interior_number       text,
  neighborhood          text,
  postal_code           text,
  municipality          text,
  state                 text,
  location_references   text,
  latitude              numeric(10, 7),
  longitude             numeric(10, 7),
  route_id              uuid,
  image_path            text,
  is_main               boolean                  DEFAULT false NOT NULL,
  is_active             boolean                  DEFAULT true NOT NULL,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT customer_branches_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT customer_branches_phone_primary_check CHECK (length(trim(phone_primary)) > 0),
  CONSTRAINT customer_branches_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT customer_branches_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

ALTER TABLE public.customer_branches
  ADD CONSTRAINT customer_branches_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_branches
  ADD CONSTRAINT customer_branches_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_branches
  ADD CONSTRAINT customer_branches_route_id_fkey
  FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;

CREATE INDEX idx_customer_branches_customer_active
  ON public.customer_branches (customer_id, is_active);

CREATE INDEX idx_customer_branches_route_active
  ON public.customer_branches (route_id, is_active)
  WHERE route_id IS NOT NULL;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_customer_fiscal_profiles_updated_at
  BEFORE UPDATE ON public.customer_fiscal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_customer_branches_updated_at
  BEFORE UPDATE ON public.customer_branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_can_manage_customers()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND (
        user_type = 'ADMIN'::public.user_profile_type
        OR (
          user_type = 'AGENT'::public.user_profile_type
          AND agent_functions @> ARRAY['SALESPERSON'::public.agent_function_type]
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.customers
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.manage_customer_fiscal_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.rfc := upper(trim(NEW.rfc));
  NEW.billing_email := lower(trim(NEW.billing_email));

  IF NEW.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_fiscal_profiles
      WHERE customer_id = NEW.customer_id
        AND is_active = true
        AND id IS DISTINCT FROM NEW.id
    )
  THEN
    NEW.is_default := true;
  END IF;

  IF NEW.is_default = true AND NEW.is_active = true THEN
    UPDATE public.customer_fiscal_profiles
    SET is_default = false
    WHERE customer_id = NEW.customer_id
      AND id IS DISTINCT FROM NEW.id
      AND is_default = true;
  END IF;

  IF NEW.is_active = false THEN
    NEW.is_default := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_customer_branch_main()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_branches
      WHERE customer_id = NEW.customer_id
        AND is_active = true
        AND id IS DISTINCT FROM NEW.id
    )
  THEN
    NEW.is_main := true;
  END IF;

  IF NEW.is_main = true AND NEW.is_active = true THEN
    UPDATE public.customer_branches
    SET is_main = false
    WHERE customer_id = NEW.customer_id
      AND id IS DISTINCT FROM NEW.id
      AND is_main = true;
  END IF;

  IF NEW.is_active = false THEN
    NEW.is_main := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customer_fiscal_profiles_default
  BEFORE INSERT OR UPDATE OF customer_id, rfc, billing_email, is_default, is_active
  ON public.customer_fiscal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.manage_customer_fiscal_default();

CREATE TRIGGER trg_customer_branches_main
  BEFORE INSERT OR UPDATE OF customer_id, is_main, is_active
  ON public.customer_branches
  FOR EACH ROW EXECUTE FUNCTION public.manage_customer_branch_main();

CREATE OR REPLACE VIEW public.customer_summaries AS
SELECT
  c.*,
  COALESCE(fp.total_fiscal_profiles, 0)::integer AS fiscal_profile_count,
  COALESCE(fp.active_fiscal_profiles, 0)::integer AS active_fiscal_profile_count,
  COALESCE(cb.total_branches, 0)::integer AS branch_count,
  COALESCE(cb.active_branches, 0)::integer AS active_branch_count,
  df.legal_name AS default_fiscal_legal_name,
  df.rfc AS default_fiscal_rfc,
  mb.name AS main_branch_name,
  mb.municipality AS main_branch_municipality,
  mb.state AS main_branch_state,
  mb.image_path AS main_branch_image_path,
  mb.route_id AS main_branch_route_id,
  r.code AS main_branch_route_code,
  r.name AS main_branch_route_name
FROM public.customers c
LEFT JOIN LATERAL (
  SELECT
    count(*) AS total_fiscal_profiles,
    count(*) FILTER (WHERE is_active = true) AS active_fiscal_profiles
  FROM public.customer_fiscal_profiles
  WHERE customer_id = c.id
) fp ON true
LEFT JOIN LATERAL (
  SELECT
    count(*) AS total_branches,
    count(*) FILTER (WHERE is_active = true) AS active_branches
  FROM public.customer_branches
  WHERE customer_id = c.id
) cb ON true
LEFT JOIN LATERAL (
  SELECT legal_name, rfc
  FROM public.customer_fiscal_profiles
  WHERE customer_id = c.id
    AND is_default = true
  ORDER BY updated_at DESC
  LIMIT 1
) df ON true
LEFT JOIN LATERAL (
  SELECT name, municipality, state, image_path, route_id
  FROM public.customer_branches
  WHERE customer_id = c.id
    AND is_main = true
  ORDER BY updated_at DESC
  LIMIT 1
) mb ON true
LEFT JOIN public.routes r ON r.id = mb.route_id;

ALTER VIEW public.customer_summaries SET (security_invoker = true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_fiscal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_branches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_fiscal_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_branches TO authenticated;
GRANT SELECT ON public.customer_summaries TO authenticated;
GRANT ALL ON public.customers TO service_role;
GRANT ALL ON public.customer_fiscal_profiles TO service_role;
GRANT ALL ON public.customer_branches TO service_role;
GRANT SELECT ON public.customer_summaries TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_customer_id() TO authenticated;

CREATE POLICY customers_select_staff_or_self
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can_manage_customers()
    OR auth_user_id = auth.uid()
  );

CREATE POLICY customers_insert_staff
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_customers());

CREATE POLICY customers_update_staff
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_customers())
  WITH CHECK (public.current_user_can_manage_customers());

CREATE POLICY customers_delete_staff
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_customers());

CREATE POLICY customer_fiscal_profiles_select_staff_or_self
  ON public.customer_fiscal_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can_manage_customers()
    OR customer_id = public.current_user_customer_id()
  );

CREATE POLICY customer_fiscal_profiles_insert_staff
  ON public.customer_fiscal_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_customers());

CREATE POLICY customer_fiscal_profiles_update_staff
  ON public.customer_fiscal_profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_customers())
  WITH CHECK (public.current_user_can_manage_customers());

CREATE POLICY customer_fiscal_profiles_delete_staff
  ON public.customer_fiscal_profiles
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_customers());

CREATE POLICY customer_branches_select_staff_or_self
  ON public.customer_branches
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can_manage_customers()
    OR customer_id = public.current_user_customer_id()
  );

CREATE POLICY customer_branches_insert_staff
  ON public.customer_branches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_manage_customers());

CREATE POLICY customer_branches_update_staff
  ON public.customer_branches
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_manage_customers())
  WITH CHECK (public.current_user_can_manage_customers());

CREATE POLICY customer_branches_delete_staff
  ON public.customer_branches
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_manage_customers());

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-branches', 'customer-branches', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access on customer-branches bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-branches');

CREATE POLICY "Customer managers can upload branch images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-branches'
  AND public.current_user_can_manage_customers()
);

CREATE POLICY "Customer managers can update branch images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'customer-branches'
  AND public.current_user_can_manage_customers()
)
WITH CHECK (
  bucket_id = 'customer-branches'
  AND public.current_user_can_manage_customers()
);

CREATE POLICY "Customer managers can delete branch images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-branches'
  AND public.current_user_can_manage_customers()
);
