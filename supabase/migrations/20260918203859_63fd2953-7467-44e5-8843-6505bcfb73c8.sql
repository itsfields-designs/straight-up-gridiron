CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  league_invite_code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'clicked',
  stripe_checkout_session_id text,
  stripe_event_id text,
  referrer_credit_amount numeric(10,2) NOT NULL DEFAULT 5.00,
  referred_credit_amount numeric(10,2) NOT NULL DEFAULT 5.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CONSTRAINT referrals_status_check CHECK (status IN ('clicked','signup','checkout','rewarded','invalid')),
  CONSTRAINT referrals_no_self CHECK (referrer_user_id <> referred_user_id)
);

CREATE UNIQUE INDEX referrals_referred_unique ON public.referrals (referred_user_id);
CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_user_id);
CREATE UNIQUE INDEX referrals_session_unique ON public.referrals (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_select_own ON public.referrals FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

CREATE TRIGGER referrals_set_updated_at BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.szn_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  type text NOT NULL,
  reference_id text,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX szn_credit_ledger_user_idx ON public.szn_credit_ledger (user_id);
CREATE UNIQUE INDEX szn_credit_ledger_unique_entry ON public.szn_credit_ledger (user_id, type, reference_id)
  WHERE reference_id IS NOT NULL;

GRANT SELECT ON public.szn_credit_ledger TO authenticated;
GRANT ALL ON public.szn_credit_ledger TO service_role;
ALTER TABLE public.szn_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY szn_credit_select_own ON public.szn_credit_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;