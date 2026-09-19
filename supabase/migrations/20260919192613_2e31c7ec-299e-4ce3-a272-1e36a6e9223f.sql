drop policy if exists cfb_standings_select on public.cfb_standings;

create policy cfb_standings_select_own
on public.cfb_standings
for select
to authenticated
using (user_id = auth.uid());

-- Shared leaderboard is exposed only through this fixed-shape function
create or replace function public.get_cfb_standings(p_week_num integer)
returns table(user_id uuid, username text, week_num integer, correct integer, missed integer, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.username, s.week_num, s.correct, s.missed, s.rank
  from public.cfb_standings s
  where s.week_num = p_week_num
  order by s.rank asc
  limit 100;
$$;

revoke all on function public.get_cfb_standings(integer) from public, anon;
grant execute on function public.get_cfb_standings(integer) to authenticated;