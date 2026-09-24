import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  assertRorkUserExists,
  authorizeRork,
  readJson,
  RorkError,
  rorkError,
  rorkJson,
} from "@/lib/rork-sync.server";

/**
 * League actions for the Rork iOS backend.
 * Rork verifies the SZN Pass against Stripe before calling, so no entitlement
 * check runs here; every other rule still applies.
 */

const userId = z.string().uuid();

const createSchema = z.object({
  action: z.literal("create"),
  user_id: userId,
  name: z.string().trim().min(1).max(80),
  rules: z.string().max(2000).optional().default(""),
  sport: z.enum(["nfl", "ncaa"]),
});

const joinSchema = z.object({
  action: z.literal("join"),
  user_id: userId,
  code: z.string().trim().min(1).max(16),
});

const referralSchema = z.object({
  action: z.literal("mark_referral_checkout"),
  user_id: userId,
  referral_id: z.string().uuid(),
  stripe_checkout_session_id: z.string().trim().min(1).max(255),
});

const bodySchema = z.discriminatedUnion("action", [createSchema, joinSchema, referralSchema]);

export const Route = createFileRoute("/api/public/rork-leagues-sync")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        try {
          const body = bodySchema.parse(await readJson(request));
          await assertRorkUserExists(body.user_id);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (body.action === "create") {
            const { data, error } = await supabaseAdmin.rpc("admin_create_league", {
              _name: body.name,
              _rules: body.rules,
              _user_id: body.user_id,
              _sport: body.sport,
            });
            if (error) throw new RorkError(error.message, 400);
            return rorkJson({ leagueId: data as string });
          }

          if (body.action === "join") {
            const code = body.code.toUpperCase();
            const { data, error } = await supabaseAdmin.rpc("admin_join_league_by_code", {
              _code: code,
              _user_id: body.user_id,
            });
            if (error) {
              if (/no league found/i.test(error.message)) {
                throw new RorkError("No league found with that code.", 404);
              }
              throw new RorkError(error.message, 400);
            }
            if (!data) throw new RorkError("No league found with that code.", 404);
            return rorkJson({ leagueId: data as string });
          }

          // mark_referral_checkout — only for the referral this player owns.
          const { data: referral, error: refErr } = await supabaseAdmin
            .from("referrals")
            .select("id, referred_user_id, status")
            .eq("id", body.referral_id)
            .maybeSingle();
          if (refErr) throw new RorkError(refErr.message, 400);
          if (!referral) throw new RorkError("Referral not found.", 404);
          if (referral.referred_user_id !== body.user_id) {
            throw new RorkError("That referral belongs to someone else.", 403);
          }

          const { markReferralCheckout } = await import("@/lib/referrals.server");
          await markReferralCheckout(body.referral_id, body.stripe_checkout_session_id);
          return rorkJson({ ok: true });
        } catch (err) {
          if (err instanceof RorkError || err instanceof z.ZodError) return rorkError(err);
          console.error("[rork-leagues-sync] failed", err);
          return rorkJson({ error: "Something went wrong. Try again." }, 500);
        }
      },
    },
  },
});
