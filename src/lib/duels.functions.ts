import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sideSchema = z.union([z.literal("home"), z.literal("away")]);
const sportSchema = z.union([z.literal("nfl"), z.literal("cfb")]).default("nfl");

/** The whole Face The Gods screen in one call: slate, duels, record and leaderboard. */
export const getDuelBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        weekNum: z.number().int().min(1).max(18).nullable().optional(),
        sport: sportSchema,
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { currentDuelWeek, weekGames, weekLocked, lockLabel, settleWeek, duelViews } =
      await import("@/lib/duels.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sport = data.sport;
    const weekNum = data.weekNum ?? (await currentDuelWeek(sport));
    await settleWeek(weekNum, sport);

    const games = await weekGames(weekNum, sport);
    const duels = await duelViews(context.userId, weekNum, sport);

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

    return {
      sport,
      weekNum,
      games,
      locked: weekLocked(games),
      lockAt: lockLabel(games),
      duels,
      myRecord: leaderboard.find((r) => r.userId === context.userId) ?? null,
      leaderboard,
    };
  });


/** Players you can challenge directly. */
export const searchDuelOpponents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("profiles").select("id, username").neq("id", context.userId);
    if (data.query) q = q.ilike("username", `%${data.query}%`);
    const { data: rows, error } = await q.order("username").limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ userId: r.id, username: r.username }));
  });

export const createDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        vsGods: z.boolean().default(false),
        opponentId: z.string().uuid().nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("@/lib/membership.functions");
    await assertEntitled(context.userId, context.claims as Record<string, unknown>);
    const { currentNflWeek, weekGames, weekLocked, buildGodsPicks } = await import(
      "@/lib/duels.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const weekNum = await currentNflWeek();
    const games = await weekGames(weekNum);
    if (games.length === 0) throw new Error("There is no NFL slate to duel over right now.");
    if (weekLocked(games)) throw new Error("This week has already kicked off. Try again next week.");
    if (data.opponentId === context.userId) throw new Error("You cannot challenge yourself.");

    const { data: duel, error } = await supabaseAdmin
      .from("duels")
      .insert({
        week_num: weekNum,
        challenger_id: context.userId,
        opponent_id: data.vsGods ? null : (data.opponentId ?? null),
        vs_gods: data.vsGods,
        status: data.vsGods ? "active" : "open",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.vsGods) {
      const gods = await buildGodsPicks(weekNum, games);
      await supabaseAdmin.from("duel_picks").insert({
        duel_id: duel.id,
        user_id: null,
        picks: gods.picks,
        reasoning: gods.reasoning,
      });
    }
    return { duelId: duel.id, weekNum };
  });

export const respondToDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ duelId: z.string().uuid(), accept: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.accept) {
      const { assertEntitled } = await import("@/lib/membership.functions");
      await assertEntitled(context.userId, context.claims as Record<string, unknown>);
    }
    const { weekGames, weekLocked } = await import("@/lib/duels.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: duel, error } = await supabaseAdmin
      .from("duels")
      .select("id, week_num, challenger_id, opponent_id, vs_gods, status")
      .eq("id", data.duelId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!duel || duel.status !== "open") throw new Error("That challenge is no longer open.");
    if (duel.challenger_id === context.userId) throw new Error("You cannot accept your own challenge.");
    if (duel.opponent_id && duel.opponent_id !== context.userId)
      throw new Error("That challenge was sent to someone else.");

    const games = await weekGames(duel.week_num);
    if (weekLocked(games)) throw new Error("This week has already kicked off.");

    if (!data.accept) {
      if (!duel.opponent_id) throw new Error("Only the invited player can decline.");
      await supabaseAdmin.from("duels").update({ status: "declined" }).eq("id", duel.id);
      return { status: "declined" as const };
    }

    const { error: upErr } = await supabaseAdmin
      .from("duels")
      .update({ status: "active", opponent_id: context.userId })
      .eq("id", duel.id)
      .eq("status", "open");
    if (upErr) throw new Error(upErr.message);
    return { status: "active" as const };
  });

export const saveDuelPicks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ duelId: z.string().uuid(), picks: z.record(z.string(), sideSchema) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("@/lib/membership.functions");
    await assertEntitled(context.userId, context.claims as Record<string, unknown>);
    const { weekGames, weekLocked } = await import("@/lib/duels.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: duel } = await supabaseAdmin
      .from("duels")
      .select("id, week_num, challenger_id, opponent_id, status")
      .eq("id", data.duelId)
      .maybeSingle();
    if (!duel) throw new Error("Duel not found.");
    if (duel.challenger_id !== context.userId && duel.opponent_id !== context.userId)
      throw new Error("You are not in this duel.");
    if (duel.status === "final" || duel.status === "declined")
      throw new Error("This duel is over.");

    const games = await weekGames(duel.week_num);
    if (weekLocked(games)) throw new Error("Picks are locked for this week.");

    const valid = new Set(games.map((g) => g.id));
    const picks: Record<string, "home" | "away"> = {};
    for (const [gameId, side] of Object.entries(data.picks)) {
      if (valid.has(gameId)) picks[gameId] = side;
    }

    // The uniqueness rule here is a partial index, so update-or-insert by hand.
    const { data: existing } = await supabaseAdmin
      .from("duel_picks")
      .select("id")
      .eq("duel_id", duel.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const { error } = existing
      ? await supabaseAdmin.from("duel_picks").update({ picks }).eq("id", existing.id)
      : await supabaseAdmin
          .from("duel_picks")
          .insert({ duel_id: duel.id, user_id: context.userId, picks });
    if (error) throw new Error(error.message);
    return { saved: Object.keys(picks).length };
  });
