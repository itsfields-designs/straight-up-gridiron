import { supabase } from "@/integrations/supabase/client";

import type { Side } from "@/lib/pool";

export const TOTAL_CFB_WEEKS = 15;

export type CfbRanking = {
  rank: number;
  team: string;
  short_name: string;
  record: string;
  points: number;
  first_place_votes: number;
  previous: number | null;
  trend: string;
  logo: string | null;
  updated_at: string;
};

export type CfbGame = {
  id: string;
  week_num: number;
  away: string;
  home: string;
  away_rank: number | null;
  home_rank: number | null;
  away_logo: string | null;
  home_logo: string | null;
  slot: string;
  sort_order: number;
  kickoff: string | null;
  state: string;
  away_score: number | null;
  home_score: number | null;
};

export type CfbWeek = { week_num: number; label: string; locked: boolean };

export type CfbStanding = {
  userId: string;
  username: string;
  weekNum: number;
  correct: number;
  missed: number;
  rank: number;
};

const GAME_COLS =
  "id, week_num, away, home, away_rank, home_rank, away_logo, home_logo, slot, sort_order, kickoff, state, away_score, home_score";

export function gradeCfbGame(game: CfbGame): Side | "tie" | null {
  if (game.home_score == null || game.away_score == null) return null;
  if (game.home_score === game.away_score) return "tie";
  return game.home_score > game.away_score ? "home" : "away";
}

/** A game is locked once it has kicked off. */
export function gameLocked(game: CfbGame): boolean {
  if (game.state !== "pre") return true;
  return game.kickoff ? new Date(game.kickoff).getTime() <= Date.now() : false;
}

export async function fetchCfbRankings(): Promise<CfbRanking[]> {
  const { data, error } = await supabase
    .from("cfb_rankings")
    .select("rank, team, short_name, record, points, first_place_votes, previous, trend, logo, updated_at")
    .order("rank", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CfbRanking[];
}

export async function fetchCfbWeek(
  weekNum: number,
): Promise<{ week: CfbWeek | null; games: CfbGame[] }> {
  const [{ data: week, error: we }, { data: games, error: ge }] = await Promise.all([
    supabase
      .from("cfb_weeks")
      .select("week_num, label, locked")
      .eq("week_num", weekNum)
      .maybeSingle(),
    supabase
      .from("cfb_games")
      .select(GAME_COLS)
      .eq("week_num", weekNum)
      .order("sort_order", { ascending: true }),
  ]);
  if (we) throw we;
  if (ge) throw ge;
  return { week: (week as CfbWeek | null) ?? null, games: (games ?? []) as CfbGame[] };
}

/** The earliest college week that still has an unfinished ranked game. */
export async function fetchCfbCurrentWeek(): Promise<number> {
  const { data, error } = await supabase
    .from("cfb_games")
    .select("week_num, state")
    .neq("state", "post")
    .order("week_num", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.week_num ?? 1;
}

export async function fetchMyCfbPicks(
  userId: string,
  weekNum: number,
): Promise<Record<string, Side>> {
  const { data, error } = await supabase
    .from("cfb_pick_entries")
    .select("picks")
    .eq("user_id", userId)
    .eq("week_num", weekNum)
    .maybeSingle();
  if (error) throw error;
  return ((data?.picks ?? {}) as Record<string, Side>) ?? {};
}

export async function saveCfbPicks(args: {
  userId: string;
  weekNum: number;
  picks: Record<string, Side>;
}) {
  const { error } = await supabase.from("cfb_pick_entries").upsert(
    {
      user_id: args.userId,
      week_num: args.weekNum,
      picks: args.picks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_num" },
  );
  if (error) throw error;
}

/** weekNum 0 = season total. */
export async function fetchCfbStandings(weekNum: number): Promise<CfbStanding[]> {
  const { data, error } = await supabase
    .from("cfb_standings")
    .select("user_id, username, week_num, correct, missed, rank")
    .eq("week_num", weekNum)
    .order("rank", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    username: r.username,
    weekNum: r.week_num,
    correct: r.correct,
    missed: r.missed,
    rank: r.rank,
  }));
}
