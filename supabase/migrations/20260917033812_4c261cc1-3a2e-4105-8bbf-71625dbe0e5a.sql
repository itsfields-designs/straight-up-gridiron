ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season_entry_fee numeric(10,2) NOT NULL DEFAULT 0;

CREATE TABLE public.season_entry_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_no integer NOT NULL DEFAULT 1 CHECK (entry_no >= 1),
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  marked_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id, entry_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_entry_payments TO authenticated;
GRANT ALL ON public.season_entry_payments TO service_role;

ALTER TABLE public.season_entry_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_entry_payments_select_league ON public.season_entry_payments
  FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

CREATE POLICY season_entry_payments_insert_owner ON public.season_entry_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_league_owner(league_id, auth.uid())
    AND marked_by = auth.uid()
    AND private.league_has_member(league_id, user_id)
  );

CREATE POLICY season_entry_payments_update_owner ON public.season_entry_payments
  FOR UPDATE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()))
  WITH CHECK (
    private.is_league_owner(league_id, auth.uid())
    AND marked_by = auth.uid()
    AND private.league_has_member(league_id, user_id)
  );

CREATE POLICY season_entry_payments_delete_owner ON public.season_entry_payments
  FOR DELETE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()));

CREATE TRIGGER season_entry_payments_updated_at
  BEFORE UPDATE ON public.season_entry_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX season_entry_payments_league_idx
  ON public.season_entry_payments (league_id);