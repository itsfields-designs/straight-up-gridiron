ALTER TABLE public.leagues ADD COLUMN sport text NOT NULL DEFAULT 'nfl' CHECK (sport IN ('nfl','ncaa'));

CREATE OR REPLACE FUNCTION private.create_league(_name text, _rules text, _user_id uuid, _sport text DEFAULT 'nfl')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'League name is required'; END IF;
  IF _sport NOT IN ('nfl','ncaa') THEN RAISE EXCEPTION 'Sport must be nfl or ncaa'; END IF;
  INSERT INTO public.leagues (name, rules, code, owner_id, sport)
  VALUES (trim(_name), coalesce(_rules, ''), public.generate_league_code(), _user_id, _sport)
  RETURNING id INTO new_id;
  INSERT INTO public.league_members (league_id, user_id) VALUES (new_id, _user_id);
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_league(_name text, _rules text, _user_id uuid, _sport text DEFAULT 'nfl')
RETURNS uuid
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  SELECT private.create_league(_name, _rules, _user_id, _sport);
$function$;

REVOKE ALL ON FUNCTION public.admin_create_league(text,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_league(text,text,uuid,text) TO service_role;