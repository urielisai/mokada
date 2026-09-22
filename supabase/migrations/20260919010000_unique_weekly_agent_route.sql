-- Serialize assignments for the same agent and reject overlapping active trips.
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='route_trips') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.route_trips;
  END IF;
END;
$$;

CREATE FUNCTION public.guard_agent_weekly_route() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.week_start_date > NEW.week_end_date THEN
    RAISE EXCEPTION 'La fecha de inicio debe ser anterior o igual al fin de la semana';
  END IF;
  IF NEW.status='CANCELLED' THEN RETURN NEW; END IF;
  -- Allow status progression for legacy overlapping trips; block new assignments.
  IF TG_OP='UPDATE' AND OLD.status<>'CANCELLED'
    AND OLD.agent_id=NEW.agent_id
    AND OLD.week_start_date=NEW.week_start_date AND OLD.week_end_date=NEW.week_end_date THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id=NEW.agent_id FOR UPDATE;
  IF EXISTS(
    SELECT 1 FROM public.route_trips trip
    WHERE trip.agent_id=NEW.agent_id AND trip.id<>NEW.id AND trip.status<>'CANCELLED'
      AND trip.week_start_date<=NEW.week_end_date AND trip.week_end_date>=NEW.week_start_date
  ) THEN
    RAISE EXCEPTION 'Este agente ya tiene una ruta asignada en esa semana';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_agent_weekly_route() FROM PUBLIC;
CREATE TRIGGER guard_agent_weekly_route
  BEFORE INSERT OR UPDATE OF agent_id,week_start_date,week_end_date,status ON public.route_trips
  FOR EACH ROW EXECUTE FUNCTION public.guard_agent_weekly_route();
