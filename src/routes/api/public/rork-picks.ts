import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  assertRorkEntitled,
  authorizeRork,
  errorResponse,
  readJson,
} from "@/lib/rork-sync.server";

/**
 * Pick saving for the external Rork backend: platform-wide Top 25 picks and
 * league pick sets. Secured by the shared RORK_SYNC_SECRET header.
 */

const sideSchema = z.union([z.literal("home"), z.literal("away")]);

const cfbSchema = z.object({
  type: z.literal("cfb"),
  user_id: z.string().uuid(),
  week_num: z.number().int().min(1).max(15),
  picks: z.record(z.string(), sideSchema),
  tiebreaker: z.number().int().min(0).max(300).nullable().optional(),
});

const leagueSchema = z.object({
  type: z.literal("league"),
  user_id: z.string().uuid(),
  league_id: z.string().uuid(),
  week_num: z.number().int().min(1).max(25),
  entry_no: z.number().int().min(1).max(50).optional(),
  picks: z.record(z.string(), sideSchema),
  tiebreaker: z.number().int().min(0).max(300).nullable().optional(),
});

const bodySchema = z.discriminatedUnion("type", [cfbSchema, leagueSchema]);

export const Route = createFileRoute("/api/public/rork-picks")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      // Read back saved picks: ?type=cfb|league&user_id=..&week_num=..[&league_id=..]
      GET: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "cfb";
        const userId = url.searchParams.get("user_id") ?? "";
        const weekNum = Number(url.searchParams.get("week_num"));
        if (!z.string().uuid().safeParse(userId).success || !Number.isFinite(weekNum)) {
          return new Response("Invalid query", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (type === "league") {
          const leagueId = url.searchParams.get("league_id") ?? "";
          if (!z.string().uuid().safeParse(leagueId).success) {
            return new Response("Invalid league_id", { status: 400 });
          }
          const { data, error } = await supabaseAdmin
            .from("pick_entries")
            .select("entry_no, picks, tiebreaker, updated_at")
            .eq("league_id", leagueId)
            .eq("user_id", userId)
            .eq("week_num", weekNum)
            .order("entry_no");
          if (error) return errorResponse(new Error(error.message), 500);
          return Response.json({ entries: data ?? [] });
        }

        const { data, error } = await supabaseAdmin
          .from("cfb_pick_entries")
          .select("picks, tiebreaker, updated_at")
          .eq("user_id", userId)
          .eq("week_num", weekNum)
          .maybeSingle();
        if (error) return errorResponse(new Error(error.message), 500);
        return Response.json({ entry: data ?? null });
      },

      POST: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        let parsed;
        try {
          parsed = bodySchema.parse(await readJson(request));
        } catch (err) {
          return errorResponse(err);
        }

        try {
          await assertRorkEntitled(parsed.user_id);
        } catch (err) {
          return errorResponse(err, 403);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        if (parsed.type === "cfb") {
          const { error } = await supabaseAdmin.from("cfb_pick_entries").upsert(
            {
              user_id: parsed.user_id,
              week_num: parsed.week_num,
              picks: parsed.picks,
              tiebreaker: parsed.tiebreaker ?? null,
              updated_at: now,
            },
            { onConflict: "user_id,week_num" },
          );
          if (error) return errorResponse(new Error(error.message), 500);
          return Response.json({ ok: true, saved: Object.keys(parsed.picks).length });
        }

        // League picks require membership in that league.
        const { data: member } = await supabaseAdmin
          .from("league_members")
          .select("user_id")
          .eq("league_id", parsed.league_id)
          .eq("user_id", parsed.user_id)
          .maybeSingle();
        if (!member) return errorResponse(new Error("Not a member of that league"), 403);

        const { error } = await supabaseAdmin.from("pick_entries").upsert(
          {
            league_id: parsed.league_id,
            week_num: parsed.week_num,
            user_id: parsed.user_id,
            entry_no: parsed.entry_no ?? 1,
            picks: parsed.picks,
            tiebreaker: parsed.tiebreaker ?? null,
            updated_at: now,
          },
          { onConflict: "league_id,week_num,user_id,entry_no" },
        );
        if (error) return errorResponse(new Error(error.message), 500);
        return Response.json({ ok: true, saved: Object.keys(parsed.picks).length });
      },
    },
  },
});
