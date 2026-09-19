alter table public.cfb_weeks add column if not exists tiebreaker_game_id text;
alter table public.cfb_pick_entries add column if not exists tiebreaker integer;
alter table public.cfb_standings add column if not exists tb_diff integer;

update public.cfb_weeks w
set tiebreaker_game_id = (
  select g.id from public.cfb_games g
  where g.week_num = w.week_num
  order by g.kickoff desc nulls last, g.sort_order desc
  limit 1
);

create or replace function public.recompute_cfb_standings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cfb_standings where true;

  insert into public.cfb_standings (user_id, username, week_num, correct, missed, tb_diff, rank)
  with graded as (
    select p.user_id,
           p.week_num,
           p.picks->>g.id as pick,
           case when g.home_score > g.away_score then 'home'
                when g.away_score > g.home_score then 'away'
                else 'tie' end as winner
    from public.cfb_pick_entries p
    join public.cfb_games g on g.week_num = p.week_num
    where g.state = 'post'
      and g.home_score is not null
      and g.away_score is not null
      and p.picks ? g.id
  ),
  weekly as (
    select user_id,
           week_num,
           count(*) filter (where pick = winner)::int as correct,
           count(*) filter (where pick is distinct from winner)::int as missed
    from graded
    group by user_id, week_num
  ),
  tb as (
    select p.user_id,
           p.week_num,
           abs(p.tiebreaker - (tg.home_score + tg.away_score))::int as tb_diff
    from public.cfb_pick_entries p
    join public.cfb_weeks w on w.week_num = p.week_num
    join public.cfb_games tg on tg.id = w.tiebreaker_game_id
    where p.tiebreaker is not null
      and tg.home_score is not null
      and tg.away_score is not null
  ),
  weekly_tb as (
    select w.user_id, w.week_num, w.correct, w.missed, t.tb_diff
    from weekly w
    left join tb t on t.user_id = w.user_id and t.week_num = w.week_num
  ),
  totals as (
    select user_id, week_num, correct, missed, tb_diff from weekly_tb
    union all
    select user_id, 0 as week_num, sum(correct)::int, sum(missed)::int,
           case when count(tb_diff) > 0 then sum(tb_diff)::int else null end
    from weekly_tb group by user_id
  )
  select t.user_id,
         coalesce(pr.username, 'Player'),
         t.week_num,
         t.correct,
         t.missed,
         t.tb_diff,
         rank() over (partition by t.week_num order by t.correct desc, t.tb_diff asc nulls last, t.missed asc)
  from totals t
  left join public.profiles pr on pr.id = t.user_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.recompute_league_standings(_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _sunday_only boolean;
  _from_week integer;
  _sport text;
BEGIN
  SELECT l.sunday_only, l.sunday_only_from_week, l.sport
    INTO _sunday_only, _from_week, _sport
  FROM public.leagues l WHERE l.id = _league_id;
  _sunday_only := COALESCE(_sunday_only, false);
  _from_week := COALESCE(_from_week, 1);
  _sport := COALESCE(_sport, 'nfl');

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
  weeks_src AS (
    SELECT w.week_num, w.tiebreaker_game_id
    FROM public.weeks w WHERE _sport <> 'ncaa'
    UNION ALL
    SELECT cw.week_num, cw.tiebreaker_game_id
    FROM public.cfb_weeks cw WHERE _sport = 'ncaa'
  ),
  tb_games AS (
    SELECT g.id, g.home_score, g.away_score FROM public.games g WHERE _sport <> 'ncaa'
    UNION ALL
    SELECT cg.id, cg.home_score, cg.away_score FROM public.cfb_games cg WHERE _sport = 'ncaa'
  ),
  graded AS (
    SELECT g.id AS game_id, g.week_num,
           CASE WHEN g.home_score > g.away_score THEN 'home' ELSE 'away' END AS winner
    FROM public.games g
    WHERE _sport <> 'ncaa'
      AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL
      AND g.home_score <> g.away_score
      AND NOT (
        _sunday_only
        AND g.week_num >= _from_week
        AND g.kickoff IS NOT NULL
        AND extract(dow FROM (g.kickoff AT TIME ZONE 'America/New_York')) BETWEEN 4 AND 6
      )
    UNION ALL
    SELECT cg.id AS game_id, cg.week_num,
           CASE WHEN cg.home_score > cg.away_score THEN 'home' ELSE 'away' END AS winner
    FROM public.cfb_games cg
    WHERE _sport = 'ncaa'
      AND cg.home_score IS NOT NULL AND cg.away_score IS NOT NULL
      AND cg.home_score <> cg.away_score
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
              FROM tb_games tg
             WHERE tg.id = w.tiebreaker_game_id
               AND tg.home_score IS NOT NULL AND tg.away_score IS NOT NULL
               AND e.tiebreaker IS NOT NULL) AS tb_diff
    FROM user_entries ue
    CROSS JOIN weeks_src w
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
$fn$;

select public.recompute_cfb_standings();
select public.recompute_all_league_standings();