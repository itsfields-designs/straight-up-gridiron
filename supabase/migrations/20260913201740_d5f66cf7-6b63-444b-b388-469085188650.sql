CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pot_type text NOT NULL CHECK (pot_type IN ('weekly','season')),
  week_num integer,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY payouts_select_league ON public.payouts FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));
CREATE POLICY payouts_insert_owner ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (private.is_league_owner(league_id, auth.uid()) AND created_by = auth.uid()
              AND private.is_league_member(league_id, user_id));
CREATE POLICY payouts_update_owner ON public.payouts FOR UPDATE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()))
  WITH CHECK (private.is_league_owner(league_id, auth.uid()));
CREATE POLICY payouts_delete_owner ON public.payouts FOR DELETE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()));

CREATE INDEX payouts_league_idx ON public.payouts (league_id, user_id);

CREATE TABLE public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deposit','withdrawal')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_transactions TO authenticated;
GRANT ALL ON public.cash_transactions TO service_role;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_select_league ON public.cash_transactions FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));
CREATE POLICY cash_insert_own ON public.cash_transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.is_league_member(league_id, auth.uid()));
CREATE POLICY cash_update_own ON public.cash_transactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cash_delete_own ON public.cash_transactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_league_owner(league_id, auth.uid()));

CREATE INDEX cash_league_idx ON public.cash_transactions (league_id, user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cash_updated_at BEFORE UPDATE ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();