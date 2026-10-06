ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS sequence_order integer DEFAULT 0 NOT NULL;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS default_vehicle_id uuid REFERENCES public.fleet_vehicles(id);
