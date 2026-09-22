ALTER TABLE public.duels
  ADD COLUMN sport text NOT NULL DEFAULT 'nfl'
  CHECK (sport IN ('nfl','cfb'));

CREATE INDEX duels_sport_week_idx ON public.duels (sport, week_num);