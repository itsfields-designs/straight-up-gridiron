-- SZN Pass subscription mirror, kept in sync by the Stripe webhook at
-- https://straight-up-gridiron-backend.rork.app/webhooks/stripe
-- Additive only and safe to re-run.

CREATE TABLE IF NOT EXISTS public.szn_memberships (
user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
stripe_customer_id text NOT NULL,
stripe_subscription_id text,
status text NOT NULL,
price_id text,
current_period_end timestamptz,
cancel_at_period_end boolean NOT NULL DEFAULT false,
canceled_at timestamptz,
ended_at timestamptz,
last_payment_at timestamptz,
last_payment_failed_at timestamptz,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS szn_memberships_customer_idx ON public.szn_memberships (stripe_customer_id);
CREATE INDEX IF NOT EXISTS szn_memberships_subscription_idx ON public.szn_memberships (stripe_subscription_id);

GRANT SELECT ON public.szn_memberships TO authenticated;
GRANT ALL ON public.szn_memberships TO service_role;
ALTER TABLE public.szn_memberships ENABLE ROW LEVEL SECURITY;

-- Members can read their own row; only the server writes.
DROP POLICY IF EXISTS szn_memberships_select_own ON public.szn_memberships;
CREATE POLICY szn_memberships_select_own ON public.szn_memberships
FOR SELECT TO authenticated
USING (user_id = auth.uid());