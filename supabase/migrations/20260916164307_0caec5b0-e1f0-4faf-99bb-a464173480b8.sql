CREATE TABLE public.entry_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  week_num integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  marked_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (league_id, week_num, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_payments TO authenticated;
GRANT ALL ON public.entry_payments TO service_role;

ALTER TABLE public.entry_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY entry_payments_select_league ON public.entry_payments
  FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

CREATE POLICY entry_payments_insert_owner ON public.entry_payments
  FOR INSERT TO authenticated
  WITH CHECK (private.is_league_owner(league_id, auth.uid())
    AND marked_by = auth.uid()
    AND private.is_league_member(league_id, user_id));

CREATE POLICY entry_payments_update_owner ON public.entry_payments
  FOR UPDATE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()))
  WITH CHECK (private.is_league_owner(league_id, auth.uid()));

CREATE POLICY entry_payments_delete_owner ON public.entry_payments
  FOR DELETE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()));

CREATE TRIGGER entry_payments_updated_at BEFORE UPDATE ON public.entry_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX entry_payments_league_week_idx ON public.entry_payments (league_id, week_num);

ALTER TABLE public.leagues
  ADD COLUMN pots_auto boolean NOT NULL DEFAULT true,
  ADD COLUMN season_pot_pct numeric(5,2) NOT NULL DEFAULT 0;