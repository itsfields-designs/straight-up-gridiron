CREATE OR REPLACE FUNCTION public.tg_league_rules_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sunday_only IS DISTINCT FROM OLD.sunday_only
     OR NEW.sunday_only_from_week IS DISTINCT FROM OLD.sunday_only_from_week THEN
    PERFORM public.recompute_league_standings(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leagues_rules_recompute ON public.leagues;
CREATE TRIGGER leagues_rules_recompute
AFTER UPDATE ON public.leagues
FOR EACH ROW EXECUTE FUNCTION public.tg_league_rules_recompute();