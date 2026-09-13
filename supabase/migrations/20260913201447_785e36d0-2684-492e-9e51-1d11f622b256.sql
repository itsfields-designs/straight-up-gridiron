CREATE OR REPLACE FUNCTION public.admin_create_league(_name text, _rules text, _user_id uuid)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.create_league(_name, _rules, _user_id);
$$;

CREATE OR REPLACE FUNCTION public.admin_join_league_by_code(_code text, _user_id uuid)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.join_league_by_code(_code, _user_id);
$$;

REVOKE ALL ON FUNCTION public.admin_create_league(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_join_league_by_code(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_league(text, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_join_league_by_code(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_league(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_join_league_by_code(text, uuid) TO service_role;