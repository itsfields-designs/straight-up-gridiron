ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_exempt boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET membership_exempt = true;