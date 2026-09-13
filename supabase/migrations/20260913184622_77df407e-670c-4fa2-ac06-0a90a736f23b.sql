-- 1. Games & weeks: writes only via the service role (automatic NFL sync). Reads unchanged.
DROP POLICY IF EXISTS games_insert ON public.games;
DROP POLICY IF EXISTS games_update ON public.games;
DROP POLICY IF EXISTS games_delete ON public.games;
DROP POLICY IF EXISTS weeks_insert ON public.weeks;
DROP POLICY IF EXISTS weeks_update ON public.weeks;

REVOKE INSERT, UPDATE, DELETE ON public.games FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.weeks FROM authenticated;
GRANT SELECT ON public.games TO authenticated;
GRANT SELECT ON public.weeks TO authenticated;
GRANT ALL ON public.games TO service_role;
GRANT ALL ON public.weeks TO service_role;

-- 2. Membership helpers may only answer about the calling user.
CREATE OR REPLACE FUNCTION public.is_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = _league_id AND user_id = _user_id
     );
$$;

CREATE OR REPLACE FUNCTION public.is_league_owner(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.leagues
       WHERE id = _league_id AND owner_id = _user_id
     );
$$;

-- 3. Profiles: visible to yourself and to people you share a league with.
CREATE OR REPLACE FUNCTION public.shares_league_with_me(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.league_members mine
       JOIN public.league_members theirs ON theirs.league_id = mine.league_id
       WHERE mine.user_id = auth.uid()
         AND theirs.user_id = _other_user_id
     );
$$;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_self_or_leaguemates
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_league_with_me(id));

-- 4. Internal routines are system-only.
REVOKE ALL ON FUNCTION public.shares_league_with_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_league_with_me(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_league_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_league_member(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_league_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_league_owner(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.recompute_league_standings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_all_league_standings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_league_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_all_league_standings() TO service_role;