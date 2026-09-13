CREATE TABLE public.league_bank_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX league_bank_deposits_league_idx ON public.league_bank_deposits (league_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_bank_deposits TO authenticated;
GRANT ALL ON public.league_bank_deposits TO service_role;

ALTER TABLE public.league_bank_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_select_league ON public.league_bank_deposits
  FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

CREATE POLICY bank_insert_owner ON public.league_bank_deposits
  FOR INSERT TO authenticated
  WITH CHECK (private.is_league_owner(league_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY bank_update_owner ON public.league_bank_deposits
  FOR UPDATE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()))
  WITH CHECK (private.is_league_owner(league_id, auth.uid()));

CREATE POLICY bank_delete_owner ON public.league_bank_deposits
  FOR DELETE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()));

CREATE TRIGGER league_bank_deposits_updated_at BEFORE UPDATE ON public.league_bank_deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.league_bank_balance(_league_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT sum(amount) FROM public.league_bank_deposits WHERE league_id = _league_id), 0)
  + COALESCE((SELECT sum(amount) FROM public.cash_transactions WHERE league_id = _league_id AND kind = 'deposit'), 0)
  - COALESCE((SELECT sum(amount) FROM public.cash_transactions WHERE league_id = _league_id AND kind = 'withdrawal'), 0)
  - COALESCE((SELECT sum(amount) FROM public.payouts WHERE league_id = _league_id), 0);
$$;

REVOKE ALL ON FUNCTION private.league_bank_balance(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tg_bank_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _league uuid;
  _bal numeric;
BEGIN
  _league := COALESCE(NEW.league_id, OLD.league_id);
  _bal := private.league_bank_balance(_league);
  IF _bal < 0 THEN
    RAISE EXCEPTION 'The league bank does not have enough money for this (short by %).', to_char(-_bal, 'FM999999990.00');
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER payouts_bank_guard
  AFTER INSERT OR UPDATE ON public.payouts
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.tg_bank_guard();

CREATE CONSTRAINT TRIGGER cash_bank_guard
  AFTER INSERT OR UPDATE ON public.cash_transactions
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.tg_bank_guard();

CREATE CONSTRAINT TRIGGER bank_deposit_guard
  AFTER UPDATE OR DELETE ON public.league_bank_deposits
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.tg_bank_guard();