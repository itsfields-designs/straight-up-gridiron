-- AP Top 25 rankings snapshot
create table public.cfb_rankings (
  rank int primary key,
  team text not null,
  short_name text not null default '',
  record text not null default '',
  points int not null default 0,
  first_place_votes int not null default 0,
  previous int,
  trend text not null default '',
  logo text,
  updated_at timestamptz not null default now()
);
grant select on public.cfb_rankings to authenticated;
grant all on public.cfb_rankings to service_role;
alter table public.cfb_rankings enable row level security;
create policy cfb_rankings_select on public.cfb_rankings for select to authenticated using (true);

-- Weeks of the college regular season
create table public.cfb_weeks (
  week_num int primary key,
  label text not null,
  locked boolean not null default false
);
grant select on public.cfb_weeks to authenticated;
grant all on public.cfb_weeks to service_role;
alter table public.cfb_weeks enable row level security;
create policy cfb_weeks_select on public.cfb_weeks for select to authenticated using (true);

-- Games involving at least one ranked team
create table public.cfb_games (
  id text primary key,
  week_num int not null,
  away text not null,
  home text not null,
  away_rank int,
  home_rank int,
  away_logo text,
  home_logo text,
  slot text not null default '',
  sort_order int not null default 0,
  kickoff timestamptz,
  state text not null default 'pre',
  away_score int,
  home_score int
);
create index cfb_games_week_idx on public.cfb_games (week_num, sort_order);
grant select on public.cfb_games to authenticated;
grant all on public.cfb_games to service_role;
alter table public.cfb_games enable row level security;
create policy cfb_games_select on public.cfb_games for select to authenticated using (true);

-- One set of college picks per player per week
create table public.cfb_pick_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num int not null,
  picks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, week_num)
);
grant select, insert, update, delete on public.cfb_pick_entries to authenticated;
grant all on public.cfb_pick_entries to service_role;
alter table public.cfb_pick_entries enable row level security;
create policy cfb_picks_own on public.cfb_pick_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Calculated college standings (week_num 0 = season total)
create table public.cfb_standings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default 'Player',
  week_num int not null,
  correct int not null default 0,
  missed int not null default 0,
  rank int not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, week_num)
);
grant select on public.cfb_standings to authenticated;
grant all on public.cfb_standings to service_role;
alter table public.cfb_standings enable row level security;
create policy cfb_standings_select on public.cfb_standings for select to authenticated using (true);

create or replace function public.recompute_cfb_standings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cfb_standings;

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

revoke all on function public.recompute_cfb_standings() from public, anon, authenticated;
grant execute on function public.recompute_cfb_standings() to service_role;