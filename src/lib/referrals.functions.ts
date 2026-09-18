import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { membershipStatus } from "@/lib/membership.functions";

export type ReferralInfo = {
  invited: number;
  successful: number;
  creditEarned: number;
  /** Referral identifier that goes in the invite link. */
  refId: string;
};

/** Records the invite a member opened, so it survives signup and checkout. */
export const attachInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ code: z.string().trim().max(16).default(""), ref: z.string().trim().max(64).default("") })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ attached: boolean }> => {
    if (!data.ref || data.ref === context.userId) return { attached: false };
    const { attachReferral } = await import("@/lib/referrals.server");
    const status = await membershipStatus(context.userId, context.claims as Record<string, unknown>);
    const referral = await attachReferral({
      referredUserId: context.userId,
      referrerUserId: data.ref,
      leagueCode: data.code,
      alreadyPaid: status.subscribed,
    });
    return { attached: !!referral };
  });

export const getReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralInfo> => {
    const { referralSummary } = await import("@/lib/referrals.server");
    const summary = await referralSummary(context.userId);
    return { ...summary, refId: context.userId };
  });
