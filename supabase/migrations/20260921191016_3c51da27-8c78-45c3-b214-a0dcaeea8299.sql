CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num integer NOT NULL,
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vs_gods boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','declined','final')),
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  gods_won boolean NOT NULL DEFAULT false,
  challenger_correct integer NOT NULL DEFAULT 0,
  opponent_correct integer NOT NULL DEFAULT 0,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX duels_week_idx ON public.duels (week_num);
CREATE INDEX duels_challenger_idx ON public.duels (challenger_id);
CREATE INDEX duels_opponent_idx ON public.duels (opponent_id);

GRANT SELECT ON public.duels TO authenticated;
GRANT ALL ON public.duels TO service_role;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY duels_select ON public.duels FOR SELECT TO authenticated USING (true);

CREATE TABLE public.duel_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX duel_picks_user_uniq ON public.duel_picks (duel_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX duel_picks_gods_uniq ON public.duel_picks (duel_id) WHERE user_id IS NULL;

GRANT SELECT ON public.duel_picks TO authenticated;
GRANT ALL ON public.duel_picks TO service_role;
ALTER TABLE public.duel_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY duel_picks_select_own ON public.duel_picks FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.duel_records (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  ties integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  gods_wins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.duel_records TO authenticated;
GRANT ALL ON public.duel_records TO service_role;
ALTER TABLE public.duel_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY duel_records_select ON public.duel_records FOR SELECT TO authenticated USING (true);

CREATE TRIGGER duels_updated_at BEFORE UPDATE ON public.duels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER duel_picks_updated_at BEFORE UPDATE ON public.duel_picks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER duel_records_updated_at BEFORE UPDATE ON public.duel_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();