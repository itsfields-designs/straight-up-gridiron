CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- internal helpers used by RLS policies
CREATE OR REPLACE FUNCTION private.is_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.league_members WHERE league_id = _league_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION private.is_league_owner(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.leagues WHERE id = _league_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION private.shares_league_with_me(_other_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.league_members mine
       JOIN public.league_members theirs ON theirs.league_id = mine.league_id
       WHERE mine.user_id = auth.uid() AND theirs.user_id = _other_user_id
     );
$$;

REVOKE ALL ON FUNCTION private.is_league_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_league_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.shares_league_with_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_league_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_league_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_league_with_me(uuid) TO authenticated, service_role;

-- repoint policies at the private helpers
DROP POLICY IF EXISTS leagues_select_members ON public.leagues;
CREATE POLICY leagues_select_members ON public.leagues FOR SELECT TO authenticated
  USING (private.is_league_member(id, auth.uid()));

DROP POLICY IF EXISTS members_select_same_league ON public.league_members;
CREATE POLICY members_select_same_league ON public.league_members FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS members_delete_self_or_owner ON public.league_members;
CREATE POLICY members_delete_self_or_owner ON public.league_members FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR private.is_league_owner(league_id, auth.uid()));

DROP POLICY IF EXISTS standings_select_league ON public.league_standings;
CREATE POLICY standings_select_league ON public.league_standings FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS picks_select_league ON public.pick_entries;
CREATE POLICY picks_select_league ON public.pick_entries FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS picks_insert_own ON public.pick_entries;
CREATE POLICY picks_insert_own ON public.pick_entries FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND private.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS profiles_select_self_or_leaguemates ON public.profiles;
CREATE POLICY profiles_select_self_or_leaguemates ON public.profiles FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR private.shares_league_with_me(id));

DROP FUNCTION IF EXISTS public.is_league_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_league_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.shares_league_with_me(uuid);

-- league creation / joining move off the public API; the app server verifies the caller
CREATE OR REPLACE FUNCTION private.create_league(_name text, _rules text, _user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'League name is required'; END IF;
  INSERT INTO public.leagues (name, rules, code, owner_id)
  VALUES (trim(_name), coalesce(_rules, ''), public.generate_league_code(), _user_id)
  RETURNING id INTO new_id;
  INSERT INTO public.league_members (league_id, user_id) VALUES (new_id, _user_id);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.join_league_by_code(_code text, _user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO target FROM public.leagues WHERE code = upper(trim(_code));
  IF target IS NULL THEN RAISE EXCEPTION 'No league found with that invite code'; END IF;
  INSERT INTO public.league_members (league_id, user_id) VALUES (target, _user_id)
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION private.create_league(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.join_league_by_code(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.create_league(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.join_league_by_code(text, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.create_league(text, text);
DROP FUNCTION IF EXISTS public.join_league_by_code(text);