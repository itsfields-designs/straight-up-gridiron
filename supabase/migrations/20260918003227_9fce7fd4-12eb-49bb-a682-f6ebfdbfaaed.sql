ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS sunday_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sunday_only_from_week integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.recompute_league_standings(_league_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sunday_only boolean;
  _from_week integer;
BEGIN
  SELECT l.sunday_only, l.sunday_only_from_week INTO _sunday_only, _from_week
  FROM public.leagues l WHERE l.id = _league_id;
  _sunday_only := COALESCE(_sunday_only, false);
  _from_week := COALESCE(_from_week, 1);

  DELETE FROM public.league_standings WHERE league_id = _league_id;

  WITH members AS (
    SELECT user_id FROM public.league_members WHERE league_id = _league_id
  ),
  user_entries AS (
    SELECT m.user_id, gs.entry_no
    FROM members m
    CROSS JOIN LATERAL generate_series(
      1,
      GREATEST(1, COALESCE((
        SELECT max(p.entry_no) FROM public.pick_entries p
        WHERE p.league_id = _league_id AND p.user_id = m.user_id
      ), 1))
    ) AS gs(entry_no)
  ),
  graded AS (
    SELECT g.id AS game_id, g.week_num,
           CASE WHEN g.home_score > g.away_score THEN 'home' ELSE 'away' END AS winner
    FROM public.games g
    WHERE g.home_score IS NOT NULL AND g.away_score IS NOT NULL
      AND g.home_score <> g.away_score
      AND NOT (
        _sunday_only
        AND g.week_num >= _from_week
        AND g.kickoff IS NOT NULL
        AND extract(dow FROM (g.kickoff AT TIME ZONE 'America/New_York')) BETWEEN 4 AND 6
      )
  ),
  entries AS (
    SELECT p.user_id, p.entry_no, p.week_num, p.picks, p.tiebreaker
    FROM public.pick_entries p WHERE p.league_id = _league_id
  ),
  weekly AS (
    SELECT ue.user_id,
           ue.entry_no,
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
    FROM user_entries ue
    CROSS JOIN public.weeks w
    LEFT JOIN entries e
           ON e.user_id = ue.user_id AND e.entry_no = ue.entry_no AND e.week_num = w.week_num
    LEFT JOIN graded gr ON gr.week_num = w.week_num
    GROUP BY ue.user_id, ue.entry_no, w.week_num, w.tiebreaker_game_id, e.user_id, e.tiebreaker
  ),
  combined AS (
    SELECT user_id, entry_no, week_num, correct, missed, tb_diff, submitted FROM weekly
    UNION ALL
    SELECT user_id, entry_no, 0, sum(correct)::int, sum(missed)::int,
           CASE WHEN count(tb_diff) > 0 THEN sum(tb_diff)::int ELSE NULL END,
           bool_or(submitted)
    FROM weekly GROUP BY user_id, entry_no
  ),
  ranked AS (
    SELECT c.*, rank() OVER (
      PARTITION BY week_num
      ORDER BY correct DESC, tb_diff ASC NULLS LAST
    ) AS rnk
    FROM combined c
  )
  INSERT INTO public.league_standings (league_id, user_id, entry_no, week_num, correct, missed, tb_diff, submitted, rank)
  SELECT _league_id, user_id, entry_no, week_num, correct, missed, tb_diff, submitted, rnk FROM ranked;
END;
$function$;