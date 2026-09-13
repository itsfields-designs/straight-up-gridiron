
REVOKE ALL ON FUNCTION public.recompute_league_standings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_all_league_standings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_picks_recompute() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_members_recompute() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_league_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_league_standings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_league_standings() TO service_role;
