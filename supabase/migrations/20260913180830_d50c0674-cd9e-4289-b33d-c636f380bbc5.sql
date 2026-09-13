
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := trim(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'player'));
  IF length(base) < 3 THEN base := base || '_fan'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, candidate);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LEAGUES
CREATE TABLE public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rules text NOT NULL DEFAULT '',
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id)
);
GRANT SELECT, DELETE ON public.league_members TO authenticated;
GRANT ALL ON public.league_members TO service_role;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = _league_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_league_owner(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leagues WHERE id = _league_id AND owner_id = _user_id);
$$;

CREATE POLICY "leagues_select_members" ON public.leagues FOR SELECT TO authenticated
  USING (public.is_league_member(id, auth.uid()));
CREATE POLICY "leagues_update_owner" ON public.leagues FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "members_select_same_league" ON public.league_members FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY "members_delete_self_or_owner" ON public.league_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_league_owner(league_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_league_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.leagues WHERE code = result);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_league(_name text, _rules text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'League name is required'; END IF;
  INSERT INTO public.leagues (name, rules, code, owner_id)
  VALUES (trim(_name), coalesce(_rules, ''), public.generate_league_code(), uid)
  RETURNING id INTO new_id;
  INSERT INTO public.league_members (league_id, user_id) VALUES (new_id, uid);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_league_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO target FROM public.leagues WHERE code = upper(trim(_code));
  IF target IS NULL THEN RAISE EXCEPTION 'No league found with that invite code'; END IF;
  INSERT INTO public.league_members (league_id, user_id) VALUES (target, uid)
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN target;
END;
$$;

-- WEEKS AND GAMES
CREATE TABLE public.weeks (
  week_num int PRIMARY KEY,
  label text NOT NULL,
  tiebreaker_game_id text,
  locked boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE ON public.weeks TO authenticated;
GRANT ALL ON public.weeks TO service_role;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weeks_select" ON public.weeks FOR SELECT TO authenticated USING (true);
CREATE POLICY "weeks_insert" ON public.weeks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "weeks_update" ON public.weeks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.games (
  id text PRIMARY KEY,
  week_num int NOT NULL REFERENCES public.weeks(week_num) ON DELETE CASCADE,
  away text NOT NULL,
  home text NOT NULL,
  slot text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  away_score int,
  home_score int
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_select" ON public.games FOR SELECT TO authenticated USING (true);
CREATE POLICY "games_insert" ON public.games FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "games_update" ON public.games FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "games_delete" ON public.games FOR DELETE TO authenticated USING (true);

-- PICKS
CREATE TABLE public.pick_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  week_num int NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  tiebreaker int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, week_num, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_entries TO authenticated;
GRANT ALL ON public.pick_entries TO service_role;
ALTER TABLE public.pick_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "picks_select_league" ON public.pick_entries FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY "picks_insert_own" ON public.pick_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_league_member(league_id, auth.uid()));
CREATE POLICY "picks_update_own" ON public.pick_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "picks_delete_own" ON public.pick_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- SEED: 2026 Week 1
INSERT INTO public.weeks (week_num, label, tiebreaker_game_id, locked) VALUES (1, 'Week 1 · 2026', 'w1g16', false);
INSERT INTO public.games (id, week_num, away, home, slot, sort_order) VALUES
 ('w1g1',1,'New England Patriots','Seattle Seahawks','Wed 9/9 · 8:20 PM',1),
 ('w1g2',1,'San Francisco 49ers','Los Angeles Rams','Thu 9/10 · Melbourne',2),
 ('w1g3',1,'Chicago Bears','Carolina Panthers','Sun 9/13 · 1:00 PM',3),
 ('w1g4',1,'Tampa Bay Buccaneers','Cincinnati Bengals','Sun 9/13 · 1:00 PM',4),
 ('w1g5',1,'Baltimore Ravens','Indianapolis Colts','Sun 9/13 · 1:00 PM',5),
 ('w1g6',1,'Buffalo Bills','Houston Texans','Sun 9/13 · 1:00 PM',6),
 ('w1g7',1,'New Orleans Saints','Detroit Lions','Sun 9/13 · 1:00 PM',7),
 ('w1g8',1,'New York Jets','Tennessee Titans','Sun 9/13 · 1:00 PM',8),
 ('w1g9',1,'Atlanta Falcons','Pittsburgh Steelers','Sun 9/13 · 1:00 PM',9),
 ('w1g10',1,'Cleveland Browns','Jacksonville Jaguars','Sun 9/13 · 1:00 PM',10),
 ('w1g11',1,'Arizona Cardinals','Los Angeles Chargers','Sun 9/13 · 4:25 PM',11),
 ('w1g12',1,'Green Bay Packers','Minnesota Vikings','Sun 9/13 · 4:25 PM',12),
 ('w1g13',1,'Washington Commanders','Philadelphia Eagles','Sun 9/13 · 4:25 PM',13),
 ('w1g14',1,'Miami Dolphins','Las Vegas Raiders','Sun 9/13 · 4:25 PM',14),
 ('w1g15',1,'Dallas Cowboys','New York Giants','Sun 9/13 · 8:20 PM SNF',15),
 ('w1g16',1,'Denver Broncos','Kansas City Chiefs','Mon 9/14 · 8:15 PM MNF',16);
