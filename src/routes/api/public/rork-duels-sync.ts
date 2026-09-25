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
 * Duel actions for the Rork iOS backend: board, opponent search, create,
 * accept/decline and pick saving. Mirrors duels.functions.ts minus the SZN Pass
 * check, which Rork performs against Stripe before calling.
 */

const userId = z.string().uuid();
const sideSchema = z.union([z.literal("home"), z.literal("away")]);
const sportSchema = z.union([z.literal("nfl"), z.literal("cfb")]);

const boardSchema = z.object({
  action: z.literal("board"),
  user_id: userId,
  sport: sportSchema.default("nfl"),
  week_num: z.number().int().min(1).max(18).nullable().optional(),
});

const opponentsSchema = z.object({
  action: z.literal("opponents"),
  user_id: userId,
  query: z.string().trim().max(40).optional(),
});

const createSchema = z.object({
  action: z.literal("create"),
  user_id: userId,
  sport: sportSchema.default("nfl"),
  vs_gods: z.boolean().default(false),
  opponent_id: z.string().uuid().nullable().optional(),
});

const respondSchema = z.object({
  action: z.literal("respond"),
  user_id: userId,
  duel_id: z.string().uuid(),
  accept: z.boolean(),
});

const picksSchema = z.object({
  action: z.literal("save_picks"),
  user_id: userId,
  duel_id: z.string().uuid(),
  picks: z.record(z.string(), sideSchema),
  tiebreaker: z.number().int().min(0).max(300).nullable().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  boardSchema,
  opponentsSchema,
  createSchema,
  respondSchema,
  picksSchema,
]);

export const Route = createFileRoute("/api/public/rork-duels-sync")({
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
          const duelsServer = await import("@/lib/duels.server");

          if (body.action === "board") {
            const sport = body.sport;

            // Grade any week that still has active duels before reading.
            const { data: pendingWeeks } = await supabaseAdmin
              .from("duels")
              .select("week_num")
              .eq("sport", sport)
              .eq("status", "active");
            for (const w of new Set((pendingWeeks ?? []).map((r) => r.week_num as number))) {
              await duelsServer.settleWeek(w, sport);
            }

            let weekNum = body.week_num ?? null;
            const upcomingWeek = await duelsServer.currentDuelWeek(sport);
            if (weekNum == null) {
              weekNum = (await duelsServer.inProgressWeek(sport)) ?? upcomingWeek;
            }

            const games = await duelsServer.weekGames(weekNum, sport);
            let duels = await duelsServer.duelViews(body.user_id, weekNum, sport);
            if (body.week_num == null && upcomingWeek !== weekNum) {
              duels = [
                ...duels,
                ...(await duelsServer.duelViews(body.user_id, upcomingWeek, sport)),
              ];
            }

            const { data: records } = await supabaseAdmin
              .from("duel_records")
              .select("user_id, wins, losses, ties, streak, best_streak, gods_wins")
              .order("wins", { ascending: false })
              .limit(50);
            const ids = (records ?? []).map((r) => r.user_id);
            const { data: profiles } = await supabaseAdmin
              .from("profiles")
              .select("id, username")
              .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
            const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.username]));

            const leaderboard = (records ?? []).map((r) => ({
              userId: r.user_id,
              username: nameOf.get(r.user_id) ?? "Player",
              wins: r.wins,
              losses: r.losses,
              ties: r.ties,
              streak: r.streak,
              bestStreak: r.best_streak,
              godsWins: r.gods_wins,
            }));

            const { count } = await supabaseAdmin
              .from("duels")
              .select("id", { count: "exact", head: true })
              .eq("status", "open")
              .eq("opponent_id", body.user_id);

            const tbGame = duelsServer.tiebreakerGame(games);

            return rorkJson({
              sport,
              weekNum,
              games,
              tiebreakerGameId: tbGame?.id ?? null,
              tiebreakerLabel: tbGame ? `${tbGame.away} at ${tbGame.home}` : null,
              tiebreakerTotal: duelsServer.tiebreakerTotal(games),
              locked: duelsServer.weekLocked(games),
              lockAt: duelsServer.lockLabel(games),
              duels,
              myRecord: leaderboard.find((r) => r.userId === body.user_id) ?? null,
              leaderboard,
              pendingChallenges: count ?? 0,
            });
          }

          if (body.action === "opponents") {
            let q = supabaseAdmin.from("profiles").select("id, username").neq("id", body.user_id);
            if (body.query) q = q.ilike("username", `%${body.query}%`);
            const { data: rows, error } = await q.order("username").limit(20);
            if (error) throw new RorkError(error.message, 400);
            return rorkJson({
              players: (rows ?? []).map((r) => ({ userId: r.id, username: r.username })),
            });
          }

          if (body.action === "create") {
            const sport = body.sport;
            const label = sport === "cfb" ? "college" : "NFL";
            const weekNum = await duelsServer.currentDuelWeek(sport);
            const games = await duelsServer.weekGames(weekNum, sport);
            if (games.length === 0) {
              throw new RorkError(`There is no ${label} slate to duel over right now.`, 409);
            }
            if (duelsServer.weekLocked(games)) {
              throw new RorkError("This week has already kicked off. Try again next week.", 409);
            }
            if (body.opponent_id === body.user_id) {
              throw new RorkError("You cannot challenge yourself.", 400);
            }

            const { data: duel, error } = await supabaseAdmin
              .from("duels")
              .insert({
                week_num: weekNum,
                sport,
                challenger_id: body.user_id,
                opponent_id: body.vs_gods ? null : (body.opponent_id ?? null),
                vs_gods: body.vs_gods,
                status: body.vs_gods ? "active" : "open",
              })
              .select("id")
              .single();
            if (error) throw new RorkError(error.message, 400);

            if (body.vs_gods) {
              const gods = await duelsServer.buildGodsPicks(weekNum, games, sport);
              await supabaseAdmin.from("duel_picks").insert({
                duel_id: duel.id,
                user_id: null,
                picks: gods.picks,
                reasoning: gods.reasoning,
                tiebreaker: gods.tiebreaker,
              });
            }
            return rorkJson({ duelId: duel.id, weekNum, sport });
          }

          if (body.action === "respond") {
            const { data: duel, error } = await supabaseAdmin
              .from("duels")
              .select("id, week_num, sport, challenger_id, opponent_id, vs_gods, status")
              .eq("id", body.duel_id)
              .maybeSingle();
            if (error) throw new RorkError(error.message, 400);
            if (!duel) throw new RorkError("Duel not found.", 404);
            if (duel.status !== "open") {
              throw new RorkError("That challenge is no longer open.", 409);
            }
            if (duel.challenger_id === body.user_id) {
              throw new RorkError("You cannot accept your own challenge.", 403);
            }
            if (duel.opponent_id && duel.opponent_id !== body.user_id) {
              throw new RorkError("That challenge was sent to someone else.", 403);
            }

            const games = await duelsServer.weekGames(
              duel.week_num,
              duel.sport === "cfb" ? "cfb" : "nfl",
            );
            if (duelsServer.weekLocked(games)) {
              throw new RorkError("This week has already kicked off.", 409);
            }

            if (!body.accept) {
              if (!duel.opponent_id) {
                throw new RorkError("Only the invited player can decline.", 403);
              }
              await supabaseAdmin.from("duels").update({ status: "declined" }).eq("id", duel.id);
              return rorkJson({ status: "declined" });
            }

            const { error: upErr } = await supabaseAdmin
              .from("duels")
              .update({ status: "active", opponent_id: body.user_id })
              .eq("id", duel.id)
              .eq("status", "open");
            if (upErr) throw new RorkError(upErr.message, 400);
            return rorkJson({ status: "active" });
          }

          // save_picks
          const { data: duel } = await supabaseAdmin
            .from("duels")
            .select("id, week_num, sport, challenger_id, opponent_id, status")
            .eq("id", body.duel_id)
            .maybeSingle();
          if (!duel) throw new RorkError("Duel not found.", 404);
          if (duel.challenger_id !== body.user_id && duel.opponent_id !== body.user_id) {
            throw new RorkError("You are not in this duel.", 403);
          }
          if (duel.status === "final" || duel.status === "declined") {
            throw new RorkError("This duel is over.", 409);
          }

          const games = await duelsServer.weekGames(
            duel.week_num,
            duel.sport === "cfb" ? "cfb" : "nfl",
          );
          if (duelsServer.weekLocked(games)) {
            throw new RorkError("Picks are locked for this week.", 409);
          }

          const valid = new Set(games.map((g) => g.id));
          const picks: Record<string, "home" | "away"> = {};
          for (const [gameId, side] of Object.entries(body.picks)) {
            if (valid.has(gameId)) picks[gameId] = side;
          }

          const { data: existing } = await supabaseAdmin
            .from("duel_picks")
            .select("id")
            .eq("duel_id", duel.id)
            .eq("user_id", body.user_id)
            .maybeSingle();

          const tiebreaker = body.tiebreaker ?? null;
          const { error: saveErr } = existing
            ? await supabaseAdmin
                .from("duel_picks")
                .update({ picks, tiebreaker })
                .eq("id", existing.id)
            : await supabaseAdmin
                .from("duel_picks")
                .insert({ duel_id: duel.id, user_id: body.user_id, picks, tiebreaker });
          if (saveErr) throw new RorkError(saveErr.message, 400);
          return rorkJson({ saved: Object.keys(picks).length });
        } catch (err) {
          if (err instanceof RorkError || err instanceof z.ZodError) return rorkError(err);
          console.error("[rork-duels-sync] failed", err);
          return rorkJson({ error: "Something went wrong. Try again." }, 500);
        }
      },
    },
  },
});
