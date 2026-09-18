/**
 * Referral attribution and SZN Credit rewards.
 *
 * One invite link carries both the league invite code and the referring
 * member, so nobody has to juggle two codes. Rewards are only ever issued
 * after a successful SZN Pass payment, and every write here is idempotent so
 * repeated Stripe webhook deliveries cannot pay twice.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const REFERRAL_CREDIT = 5;
export const REFERRAL_COUPON_ID = "szn_referral_5";

export type ReferralRow = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  league_id: string | null;
  league_invite_code: string;
  status: string;
  stripe_checkout_session_id: string | null;
};

const OPEN_STATUSES = ["clicked", "signup", "checkout"];

async function leagueIdForCode(code: string): Promise<string | null> {
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from("leagues")
    .select("id")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  return data?.id ?? null;
}

/** True once the account has ever paid for (or been granted) the SZN Pass. */
export async function alreadyEntitled(userId: string, hasActivePass: boolean) {
  if (hasActivePass) return true;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("membership_exempt")
    .eq("id", userId)
    .maybeSingle();
  return data?.membership_exempt === true;
}

export async function findReferralForUser(referredUserId: string) {
  const { data } = await supabaseAdmin
    .from("referrals")
    .select("*")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  return (data as ReferralRow | null) ?? null;
}

/**
 * Records the first valid attribution for a newly referred member. Later
 * links are ignored, so the referrer cannot be swapped after checkout starts.
 */
export async function attachReferral(args: {
  referredUserId: string;
  referrerUserId: string;
  leagueCode: string;
  alreadyPaid: boolean;
}): Promise<ReferralRow | null> {
  const { referredUserId, referrerUserId, leagueCode } = args;
  if (!referrerUserId || referrerUserId === referredUserId) return null;

  const existing = await findReferralForUser(referredUserId);
  if (existing) {
    // Attribution is locked; only fill in the league when it was unknown.
    if (!existing.league_id && leagueCode && OPEN_STATUSES.includes(existing.status)) {
      const leagueId = await leagueIdForCode(leagueCode);
      if (leagueId) {
        await supabaseAdmin
          .from("referrals")
          .update({ league_id: leagueId, league_invite_code: leagueCode.toUpperCase() })
          .eq("id", existing.id);
      }
    }
    return existing;
  }

  // Someone who already has the pass cannot be retroactively referred.
  if (await alreadyEntitled(referredUserId, args.alreadyPaid)) return null;

  const { data: referrer } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", referrerUserId)
    .maybeSingle();
  if (!referrer) return null;

  const { data, error } = await supabaseAdmin
    .from("referrals")
    .insert({
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      league_id: await leagueIdForCode(leagueCode),
      league_invite_code: leagueCode ? leagueCode.toUpperCase() : "",
      status: "signup",
    })
    .select("*")
    .maybeSingle();
  if (error) {
    // Unique index race — the first attribution wins.
    return await findReferralForUser(referredUserId);
  }
  return (data as ReferralRow | null) ?? null;
}

/** Locks the referral to the checkout session that was just opened. */
export async function markReferralCheckout(referralId: string, sessionId: string) {
  await supabaseAdmin
    .from("referrals")
    .update({ status: "checkout", stripe_checkout_session_id: sessionId })
    .eq("id", referralId)
    .in("status", OPEN_STATUSES);
}

export function referralIsOpen(referral: ReferralRow | null) {
  return !!referral && OPEN_STATUSES.includes(referral.status);
}

async function addCredit(args: {
  userId: string;
  amount: number;
  type: string;
  referenceId: string;
  description: string;
}) {
  const { error } = await supabaseAdmin.from("szn_credit_ledger").insert({
    user_id: args.userId,
    amount: args.amount,
    type: args.type,
    reference_id: args.referenceId,
    description: args.description,
  });
  // Duplicate key means this credit was already issued — that is a success.
  if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw new Error(error.message);
}

/** True when this Stripe event was handled already. */
export async function alreadyProcessed(eventId: string) {
  const { data } = await supabaseAdmin
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  return !!data;
}

/** Records the Stripe event so retries are ignored. */
export async function claimStripeEvent(eventId: string, type: string) {
  const { error } = await supabaseAdmin.from("stripe_events").insert({ id: eventId, type });
  if (error) return false;
  return true;
}


/**
 * Issues both $5 credits once the referred member's SZN Pass payment lands.
 */
export async function rewardReferral(args: {
  referredUserId: string;
  sessionId: string;
  eventId: string;
}) {
  const referral = await findReferralForUser(args.referredUserId);
  if (!referral) return { rewarded: false, reason: "no referral" };
  if (referral.status === "rewarded") return { rewarded: false, reason: "already rewarded" };
  if (referral.status === "invalid") return { rewarded: false, reason: "invalid referral" };
  if (referral.referrer_user_id === referral.referred_user_id)
    return { rewarded: false, reason: "self referral" };

  await addCredit({
    userId: referral.referred_user_id,
    amount: REFERRAL_CREDIT,
    type: "referral_bonus",
    referenceId: referral.id,
    description: "Welcome credit for joining through an invite link",
  });
  await addCredit({
    userId: referral.referrer_user_id,
    amount: REFERRAL_CREDIT,
    type: "referral_reward",
    referenceId: referral.id,
    description: "A friend you invited bought The SZN Pass",
  });

  await supabaseAdmin
    .from("referrals")
    .update({
      status: "rewarded",
      rewarded_at: new Date().toISOString(),
      stripe_checkout_session_id: referral.stripe_checkout_session_id ?? args.sessionId,
      stripe_event_id: args.eventId,
    })
    .eq("id", referral.id)
    .neq("status", "rewarded");

  return { rewarded: true, referral };
}

export type ReferralSummary = {
  invited: number;
  successful: number;
  creditEarned: number;
};

export async function referralSummary(userId: string): Promise<ReferralSummary> {
  const { data: refs } = await supabaseAdmin
    .from("referrals")
    .select("status")
    .eq("referrer_user_id", userId);
  const { data: ledger } = await supabaseAdmin
    .from("szn_credit_ledger")
    .select("amount")
    .eq("user_id", userId);
  const rows = refs ?? [];
  return {
    invited: rows.length,
    successful: rows.filter((r) => r.status === "rewarded").length,
    creditEarned: (ledger ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
  };
}
