
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_league_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_league_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_league_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_league(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_league_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(text) TO authenticated;
