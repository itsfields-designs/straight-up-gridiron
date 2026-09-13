
CREATE OR REPLACE FUNCTION public.recompute_league_standings(_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.league_standings WHERE league_id = _league_id;

  WITH members AS (
    SELECT user_id FROM public.league_members WHERE league_id = _league_id
  ),
  graded AS (
    SELECT g.id AS game_id, g.week_num,
           CASE WHEN g.home_score > g.away_score THEN 'home' ELSE 'away' END AS winner
    FROM public.games g
    WHERE g.home_score IS NOT NULL AND g.away_score IS NOT NULL
      AND g.home_score <> g.away_score
  ),
  entries AS (
    SELECT p.user_id, p.week_num, p.picks, p.tiebreaker
    FROM public.pick_entries p WHERE p.league_id = _league_id
  ),
  weekly AS (
    SELECT m.user_id,
           w.week_num,
           count(*) FILTER (
             WHERE gr.game_id IS NOT NULL AND e.picks ->> gr.game_id = gr.winner
           ) AS correct,
           count(*) FILTER (
             WHERE gr.game_id IS NOT NULL
               AND (e.picks IS NULL OR e.picks ->> gr.game_id IS DISTINCT FROM gr.winner)
           ) AS missed,
           (e.user_id IS NOT NULL) AS submitted,
           (SELECT abs(e.tiebreaker - (tg.home_score + tg.away_score))
              FROM public.games tg
             WHERE tg.id = w.tiebreaker_game_id
               AND tg.home_score IS NOT NULL AND tg.away_score IS NOT NULL
               AND e.tiebreaker IS NOT NULL) AS tb_diff
    FROM members m
    CROSS JOIN public.weeks w
    LEFT JOIN entries e ON e.user_id = m.user_id AND e.week_num = w.week_num
    LEFT JOIN graded gr ON gr.week_num = w.week_num
    GROUP BY m.user_id, w.week_num, w.tiebreaker_game_id, e.user_id, e.tiebreaker
  ),
  combined AS (
    SELECT user_id, week_num, correct, missed, tb_diff, submitted FROM weekly
    UNION ALL
    SELECT user_id, 0, sum(correct)::int, sum(missed)::int,
           CASE WHEN count(tb_diff) > 0 THEN sum(tb_diff)::int ELSE NULL END,
           bool_or(submitted)
    FROM weekly GROUP BY user_id
  ),
  ranked AS (
    SELECT c.*, rank() OVER (
      PARTITION BY week_num
      ORDER BY correct DESC, tb_diff ASC NULLS LAST
    ) AS rnk
    FROM combined c
  )
  INSERT INTO public.league_standings (league_id, user_id, week_num, correct, missed, tb_diff, submitted, rank)
  SELECT _league_id, user_id, week_num, correct, missed, tb_diff, submitted, rnk FROM ranked;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_league_standings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_league_standings(uuid) TO service_role;
