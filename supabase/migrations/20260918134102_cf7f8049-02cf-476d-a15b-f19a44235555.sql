ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS commissioner_cut_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commissioner_cut_pct numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_commissioner_cut_pct_range CHECK (commissioner_cut_pct >= 0 AND commissioner_cut_pct <= 100);