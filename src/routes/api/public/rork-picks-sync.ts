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
 * Top 25 college pick'em for the Rork iOS backend: saving weekly picks and
 * reading the shared leaderboard. Mirrors cfb.functions.ts minus the SZN Pass
 * check, which Rork performs against Stripe before calling.
 */

const sideSchema = z.union([z.literal("home"), z.literal("away")]);

const savePicksSchema = z.object({
  action: z.literal("save_picks"),
  user_id: z.string().uuid(),
  week_num: z.number().int().min(1).max(15),
  picks: z.record(z.string(), sideSchema),
  tiebreaker: z.number().int().min(0).max(300).nullable().optional(),
});

const standingsSchema = z.object({
  action: z.literal("standings"),
  user_id: z.string().uuid().optional(),
  week_num: z.number().int().min(0).max(15),
});

const bodySchema = z.discriminatedUnion("action", [savePicksSchema, standingsSchema]);

export const Route = createFileRoute("/api/public/rork-picks-sync")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        try {
          const body = bodySchema.parse(await readJson(request));
          if (body.user_id) await assertRorkUserExists(body.user_id);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (body.action === "standings") {
            const { data: rows, error } = await supabaseAdmin
              .from("cfb_standings")
              .select("user_id, username, week_num, correct, missed, rank")
              .eq("week_num", body.week_num)
              .order("rank", { ascending: true })
              .limit(100);
            if (error) throw new RorkError("Could not load the college leaderboard", 400);
            return rorkJson({
              standings: (rows ?? []).map((r) => ({
                userId: r.user_id as string,
                username: r.username as string,
                weekNum: r.week_num as number,
                correct: r.correct as number,
                missed: r.missed as number,
                rank: r.rank as number,
              })),
            });
          }

          // save_picks — the week must be open and the first game not started.
          const { data: week } = await supabaseAdmin
            .from("cfb_weeks")
            .select("week_num, locked")
            .eq("week_num", body.week_num)
            .maybeSingle();
          if (week?.locked) throw new RorkError("Picks are locked for this week.", 409);

          const { data: games, error: gamesErr } = await supabaseAdmin
            .from("cfb_games")
            .select("id, kickoff, state")
            .eq("week_num", body.week_num);
          if (gamesErr) throw new RorkError(gamesErr.message, 400);
          if (!games || games.length === 0) {
            throw new RorkError("There is no college slate for that week yet.", 404);
          }

          const kickoffs = games
            .map((g) => (g.kickoff ? new Date(g.kickoff as string).getTime() : null))
            .filter((t): t is number => t !== null);
          const firstKickoff = kickoffs.length ? Math.min(...kickoffs) : null;
          const started =
            games.some((g) => g.state !== "pre") ||
            (firstKickoff !== null && firstKickoff <= Date.now());
          if (started) throw new RorkError("Picks are locked for this week.", 409);

          const valid = new Set(games.map((g) => g.id as string));
          const picks: Record<string, "home" | "away"> = {};
          for (const [gameId, side] of Object.entries(body.picks)) {
            if (valid.has(gameId)) picks[gameId] = side;
          }

          const { error } = await supabaseAdmin.from("cfb_pick_entries").upsert(
            {
              user_id: body.user_id,
              week_num: body.week_num,
              picks,
              tiebreaker: body.tiebreaker ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,week_num" },
          );
          if (error) throw new RorkError(error.message, 400);
          return rorkJson({ saved: Object.keys(picks).length });
        } catch (err) {
          if (err instanceof RorkError || err instanceof z.ZodError) return rorkError(err);
          console.error("[rork-picks-sync] failed", err);
          return rorkJson({ error: "Something went wrong. Try again." }, 500);
        }
      },
    },
  },
});
