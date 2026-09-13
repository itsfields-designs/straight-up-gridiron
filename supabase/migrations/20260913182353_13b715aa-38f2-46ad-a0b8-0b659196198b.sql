
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS kickoff timestamptz,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pre';

DELETE FROM public.games WHERE week_num IS NOT NULL;

UPDATE public.weeks SET label = 'Week 1' WHERE week_num = 1;
INSERT INTO public.weeks (week_num, label, locked)
SELECT n, 'Week ' || n, false FROM generate_series(2, 18) AS n
ON CONFLICT (week_num) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.weeks TO authenticated;
GRANT ALL ON public.weeks TO service_role;
GRANT ALL ON public.leagues TO service_role;
GRANT ALL ON public.league_members TO service_role;
GRANT ALL ON public.pick_entries TO service_role;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.league_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_num integer NOT NULL, -- 0 = season total
  correct integer NOT NULL DEFAULT 0,
  missed integer NOT NULL DEFAULT 0,
  tb_diff integer,
  submitted boolean NOT NULL DEFAULT false,
  rank integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id, week_num)
);

GRANT SELECT ON public.league_standings TO authenticated;
GRANT ALL ON public.league_standings TO service_role;

ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY standings_select_league ON public.league_standings
  FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));

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
           count(*) FILTER (WHERE e.picks ->> gr.game_id = gr.winner) AS correct,
           count(*) FILTER (WHERE e.picks IS NULL OR e.picks ->> gr.game_id IS DISTINCT FROM gr.winner) AS missed,
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

REVOKE ALL ON FUNCTION public.recompute_league_standings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_league_standings(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_all_league_standings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  l record;
  n integer := 0;
BEGIN
  FOR l IN SELECT id FROM public.leagues LOOP
    PERFORM public.recompute_league_standings(l.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_all_league_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_all_league_standings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_picks_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recompute_league_standings(COALESCE(NEW.league_id, OLD.league_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS picks_recompute ON public.pick_entries;
CREATE TRIGGER picks_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.pick_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_picks_recompute();

CREATE OR REPLACE FUNCTION public.tg_members_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recompute_league_standings(COALESCE(NEW.league_id, OLD.league_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS members_recompute ON public.league_members;
CREATE TRIGGER members_recompute
AFTER INSERT OR DELETE ON public.league_members
FOR EACH ROW EXECUTE FUNCTION public.tg_members_recompute();
