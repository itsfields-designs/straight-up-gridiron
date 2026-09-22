DROP POLICY IF EXISTS cfb_rankings_select ON public.cfb_rankings;
CREATE POLICY cfb_rankings_select ON public.cfb_rankings
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS cfb_weeks_select ON public.cfb_weeks;
CREATE POLICY cfb_weeks_select ON public.cfb_weeks
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS cfb_games_select ON public.cfb_games;
CREATE POLICY cfb_games_select ON public.cfb_games
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS weeks_select ON public.weeks;
CREATE POLICY weeks_select ON public.weeks
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS games_select ON public.games;
CREATE POLICY games_select ON public.games
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duels_select ON public.duels;
CREATE POLICY duels_select ON public.duels
FOR SELECT TO authenticated
USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

DROP POLICY IF EXISTS duel_records_select ON public.duel_records;
CREATE POLICY duel_records_select ON public.duel_records
FOR SELECT TO authenticated
USING (user_id = auth.uid());