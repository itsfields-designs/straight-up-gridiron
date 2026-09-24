import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  assertRorkEntitled,
  authorizeRork,
  errorResponse,
  readJson,
} from "@/lib/rork-sync.server";

/**
 * Duel actions for the external Rork backend: create, accept/decline and save
 * picks. Secured by the shared RORK_SYNC_SECRET header.
 */

const sideSchema = z.union([z.literal("home"), z.literal("away")]);
const sportSchema = z.union([z.literal("nfl"), z.literal("cfb")]).default("nfl");

const createSchema = z.object({
  action: z.literal("create"),
  user_id: z.string().uuid(),
  sport: sportSchema,
  vs_gods: z.boolean().default(false),
  opponent_id: z.string().uuid().nullable().optional(),
});

const respondSchema = z.object({
  action: z.literal("respond"),
  user_id: z.string().uuid(),
  duel_id: z.string().uuid(),
  accept: z.boolean(),
});

const picksSchema = z.object({
  action: z.literal("save_picks"),
  user_id: z.string().uuid(),
  duel_id: z.string().uuid(),
  picks: z.record(z.string(), sideSchema),
  tiebreaker: z.number().int().min(0).max(300).nullable().optional(),
});

const bodySchema = z.discriminatedUnion("action", [createSchema, respondSchema, picksSchema]);

export const Route = createFileRoute("/api/public/rork-duels")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      // The duel board for one player: ?user_id=..&sport=nfl|cfb[&week_num=..]
      GET: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const userId = url.searchParams.get("user_id") ?? "";
        if (!z.string().uuid().safeParse(userId).success) {
          return new Response("Invalid user_id", { status: 400 });
        }
        const sport = url.searchParams.get("sport") === "cfb" ? "cfb" : "nfl";
        const weekParam = Number(url.searchParams.get("week_num"));

        const { currentDuelWeek, weekGames, weekLocked, lockLabel, duelViews, tiebreakerGame } =
          await import("@/lib/duels.server");

        const weekNum = Number.isFinite(weekParam) && weekParam > 0
          ? weekParam
          : await currentDuelWeek(sport);
        const games = await weekGames(weekNum, sport);
        const duels = await duelViews(userId, weekNum, sport);
        const tb = tiebreakerGame(games);

        return Response.json({
          sport,
          week_num: weekNum,
          games,
          locked: weekLocked(games),
          lock_at: lockLabel(games),
          tiebreaker_game_id: tb?.id ?? null,
          duels,
        });
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

        const needsPass = parsed.action !== "respond" || parsed.accept;
        if (needsPass) {
          try {
            await assertRorkEntitled(parsed.user_id);
          } catch (err) {
            return errorResponse(err, 403);
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { currentDuelWeek, weekGames, weekLocked, buildGodsPicks } = await import(
          "@/lib/duels.server"
        );

        try {
          if (parsed.action === "create") {
            const sport = parsed.sport;
            const label = sport === "cfb" ? "college" : "NFL";
            const weekNum = await currentDuelWeek(sport);
            const games = await weekGames(weekNum, sport);
            if (games.length === 0) throw new Error(`There is no ${label} slate to duel over.`);
            if (weekLocked(games)) throw new Error("This week has already kicked off.");
            if (parsed.opponent_id === parsed.user_id)
              throw new Error("You cannot challenge yourself.");

            const { data: duel, error } = await supabaseAdmin
              .from("duels")
              .insert({
                week_num: weekNum,
                sport,
                challenger_id: parsed.user_id,
                opponent_id: parsed.vs_gods ? null : (parsed.opponent_id ?? null),
                vs_gods: parsed.vs_gods,
                status: parsed.vs_gods ? "active" : "open",
              })
              .select("id")
              .single();
            if (error) throw new Error(error.message);

            if (parsed.vs_gods) {
              const gods = await buildGodsPicks(weekNum, games, sport);
              await supabaseAdmin.from("duel_picks").insert({
                duel_id: duel.id,
                user_id: null,
                picks: gods.picks,
                reasoning: gods.reasoning,
                tiebreaker: gods.tiebreaker,
              });
            }
            return Response.json({ ok: true, duel_id: duel.id, week_num: weekNum, sport });
          }

          if (parsed.action === "respond") {
            const { data: duel, error } = await supabaseAdmin
              .from("duels")
              .select("id, week_num, sport, challenger_id, opponent_id, vs_gods, status")
              .eq("id", parsed.duel_id)
              .maybeSingle();
            if (error) throw new Error(error.message);
            if (!duel || duel.status !== "open")
              throw new Error("That challenge is no longer open.");
            if (duel.challenger_id === parsed.user_id)
              throw new Error("You cannot accept your own challenge.");
            if (duel.opponent_id && duel.opponent_id !== parsed.user_id)
              throw new Error("That challenge was sent to someone else.");

            const games = await weekGames(duel.week_num, duel.sport === "cfb" ? "cfb" : "nfl");
            if (weekLocked(games)) throw new Error("This week has already kicked off.");

            if (!parsed.accept) {
              if (!duel.opponent_id) throw new Error("Only the invited player can decline.");
              await supabaseAdmin.from("duels").update({ status: "declined" }).eq("id", duel.id);
              return Response.json({ ok: true, status: "declined" });
            }

            const { error: upErr } = await supabaseAdmin
              .from("duels")
              .update({ status: "active", opponent_id: parsed.user_id })
              .eq("id", duel.id)
              .eq("status", "open");
            if (upErr) throw new Error(upErr.message);
            return Response.json({ ok: true, status: "active" });
          }

          const { data: duel } = await supabaseAdmin
            .from("duels")
            .select("id, week_num, sport, challenger_id, opponent_id, status")
            .eq("id", parsed.duel_id)
            .maybeSingle();
          if (!duel) throw new Error("Duel not found.");
          if (duel.challenger_id !== parsed.user_id && duel.opponent_id !== parsed.user_id)
            throw new Error("You are not in this duel.");
          if (duel.status === "final" || duel.status === "declined")
            throw new Error("This duel is over.");

          const games = await weekGames(duel.week_num, duel.sport === "cfb" ? "cfb" : "nfl");
          if (weekLocked(games)) throw new Error("Picks are locked for this week.");

          const valid = new Set(games.map((g) => g.id));
          const picks: Record<string, "home" | "away"> = {};
          for (const [gameId, side] of Object.entries(parsed.picks)) {
            if (valid.has(gameId)) picks[gameId] = side;
          }

          const { data: existing } = await supabaseAdmin
            .from("duel_picks")
            .select("id")
            .eq("duel_id", duel.id)
            .eq("user_id", parsed.user_id)
            .maybeSingle();

          const tiebreaker = parsed.tiebreaker ?? null;
          const { error } = existing
            ? await supabaseAdmin
                .from("duel_picks")
                .update({ picks, tiebreaker })
                .eq("id", existing.id)
            : await supabaseAdmin
                .from("duel_picks")
                .insert({ duel_id: duel.id, user_id: parsed.user_id, picks, tiebreaker });
          if (error) throw new Error(error.message);
          return Response.json({ ok: true, saved: Object.keys(picks).length });
        } catch (err) {
          console.error("[rork-duels] failed", err);
          return errorResponse(err, 400);
        }
      },
    },
  },
});
