import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Refreshes the AP Top 25 and the ranked-team slate, then regrades college picks. */
export const refreshCfb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { week?: number | null } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { syncCfb, TOTAL_CFB_WEEKS } = await import("@/lib/cfb-sync.server");
    const week = data.week;
    const result = await syncCfb(
      week && week >= 1 && week <= TOTAL_CFB_WEEKS ? [Math.trunc(week)] : undefined,
    );
    return { ok: true as const, ...result };
  });

const sideSchema = z.union([z.literal("home"), z.literal("away")]);

/** Saves Top 25 pick'em picks. Requires an active SZN Pass. */
export const saveMyCfbPicks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        weekNum: z.number().int().min(1).max(15),
        picks: z.record(z.string(), sideSchema),
        tiebreaker: z.number().int().min(0).max(300).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("@/lib/membership.functions");
    await assertEntitled(context.userId, context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("cfb_pick_entries").upsert(
      {
        user_id: context.userId,
        week_num: data.weekNum,
        picks: data.picks,
        tiebreaker: data.tiebreaker,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_num" },
    );
    if (error) throw new Error(error.message);
    return { saved: Object.keys(data.picks).length };
  });

/**
 * Shared college leaderboard. The cfb_standings table only lets each user read
 * their own rows; the shared board is served here through a fixed column list.
 */
export const getCfbStandings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ weekNum: z.number().int().min(0).max(15) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("cfb_standings")
      .select("user_id, username, week_num, correct, missed, rank")
      .eq("week_num", data.weekNum)
      .order("rank", { ascending: true })
      .limit(100);
    if (error) throw new Error("Could not load the college leaderboard");
    return (rows ?? []).map((r) => ({
      userId: r.user_id as string,
      username: r.username as string,
      weekNum: r.week_num as number,
      correct: r.correct as number,
      missed: r.missed as number,
      rank: r.rank as number,
    }));
  });
