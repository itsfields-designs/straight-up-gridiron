create or replace function public.recompute_cfb_standings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cfb_standings where true;

  insert into public.cfb_standings (user_id, username, week_num, correct, missed, rank)
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
  totals as (
    select user_id, week_num, correct, missed from weekly
    union all
    select user_id, 0 as week_num, sum(correct)::int, sum(missed)::int from weekly group by user_id
  )
  select t.user_id,
         coalesce(pr.username, 'Player'),
         t.week_num,
         t.correct,
         t.missed,
         rank() over (partition by t.week_num order by t.correct desc, t.missed asc)
  from totals t
  left join public.profiles pr on pr.id = t.user_id;
end;
$$;