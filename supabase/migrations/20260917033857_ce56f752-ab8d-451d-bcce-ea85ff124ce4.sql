ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season_pot_auto boolean NOT NULL DEFAULT false;