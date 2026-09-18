# Stripe Integration TODO

Hosted Stripe Checkout is wired into the existing membership flow. This file is the single source of truth for remaining setup.

## Values to Replace

All `sample_only` parameters already hold real, non-placeholder values — nothing to replace.

**Files containing these parameters:**

- [src/lib/membership.functions.ts](src/lib/membership.functions.ts)

| Field | Current Value | Status |
|-------|---------------|--------|
| mode | subscription | Correct — The SZN Pass is recurring yearly billing. |
| success_url | `{origin}/dashboard?membership=success` | Real URL, no change needed. |
| cancel_url | `{origin}/dashboard?membership=cancelled` | Real URL, no change needed. |
| line_items[].price | price_1UFQDrGiGKDpcCCVw7HtznqY | Real Stripe Price ID ($49.99/year). |

## Configured Parameters

These were configured in Checkout Studio and are already set.

**Files containing these parameters:**

- [src/lib/membership.functions.ts](src/lib/membership.functions.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page (Stripe Node SDK 22.6.2, so `hosted_page`; SDKs below 21.0.0 use `hosted`) |
| billing_address_collection | auto |
| phone_number_collection | { enabled: false } |
| automatic_tax | { enabled: false } |
| allow_promotion_codes | true |
| payment_method_collection | always (mode is `subscription`) |
| submit_type | auto |
| saved_payment_method_options | { payment_method_save: "enabled" } |
| origin_context | web |

Note: `integration_identifier: hosted_web_0002` is not accepted by the installed SDK's Checkout Session types and was therefore not added.

## Setup

- `STRIPE_SECRET_KEY` is already stored as a server-side secret (never prefixed with `VITE_`).
- Dependency `stripe@^22.6.2` is installed. The client is created without an explicit API version.
- Enable the Stripe Customer Portal (Settings → Billing → Customer portal) so "Manage subscription" works.

## How it works

1. A signed-in member clicks "Get The SZN Pass" on the dashboard.
2. `createSznCheckout` (authenticated server function) creates a hosted Checkout Session and returns its URL.
3. The member pays on Stripe's hosted page and returns to `/dashboard?membership=success`.
4. `checkMembership` looks up the Stripe customer by email and reports active subscription status plus renewal date.
5. `openCustomerPortal` sends active members to Stripe's billing portal.

## Testing

In test mode use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

## Referral rewards

- Webhook endpoint: `POST /api/public/stripe-webhook` (registered in Stripe, live mode, events `checkout.session.completed` + `checkout.session.async_payment_succeeded`).
- `STRIPE_WEBHOOK_SECRET` holds the endpoint signing secret; signatures are verified before anything is processed.
- Coupon `szn_referral_5` ($5 off, once) is applied at checkout for a referred member.
- Checkout metadata: `product`, `user_id`, `league_id`, `league_invite_code`, `referrer_user_id`, `referral_id`.
- On a paid event both sides get a $5 `szn_credit_ledger` entry (`referral_bonus` / `referral_reward`) and the referral is marked rewarded. Event ids are recorded in `stripe_events`, and unique indexes make retries safe.

## Next steps

- Add `customer.subscription.deleted` handling if you want membership state stored locally instead of read live from Stripe.
- Update pricing by creating a new Stripe Price and changing `SZN_PASS.priceId`.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
