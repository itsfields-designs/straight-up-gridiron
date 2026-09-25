/**
 * Face The Gods — head-to-head pick'em duels for the NFL and college football.
 *
 * All writes happen here with the admin client after the caller has been
 * verified, because a duel always touches two people's rows.
 */
import type { Side } from "@/lib/pool";

export type DuelSport = "nfl" | "cfb";

export type GameRow = {
  id: string;
  week_num: number;
  away: string;
  home: string;
  slot: string;
  sort_order: number;
  away_score: number | null;
  home_score: number | null;
  kickoff: string | null;
  state: string;
  away_rank?: number | null;
  home_rank?: number | null;
  away_logo?: string | null;
  home_logo?: string | null;
};

export type DuelSideView = {
  userId: string | null;
  username: string;
  picks: Record<string, Side>;
  correct: number;
  isGods: boolean;
};

export const MAX_WEEK: Record<DuelSport, number> = { nfl: 18, cfb: 15 };

function gamesTable(sport: DuelSport) {
  return sport === "cfb" ? ("cfb_games" as const) : ("games" as const);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The next duelable week: the earliest week that has not kicked off yet. */
export async function currentDuelWeek(sport: DuelSport = "nfl"): Promise<number> {
  const db = await admin();
  const now = new Date().toISOString();
  const { data } = await db
    .from(gamesTable(sport))
    .select("week_num, kickoff")
    .not("kickoff", "is", null)
    .order("kickoff", { ascending: true });

  const first = new Map<number, string>();
  for (const g of data ?? []) {
    if (g.kickoff && !first.has(g.week_num)) first.set(g.week_num, g.kickoff);
  }
  const upcoming = [...first.entries()].filter(([, k]) => k > now).sort((a, b) => a[0] - b[0])[0];
  if (upcoming) return upcoming[0];

  const { data: fallback } = await db
    .from(gamesTable(sport))
    .select("week_num")
    .neq("state", "post")
    .order("week_num", { ascending: true })
    .limit(1);
  return fallback?.[0]?.week_num ?? MAX_WEEK[sport];
}

/** Kept for callers that only ever duel over the NFL slate. */
export const currentNflWeek = () => currentDuelWeek("nfl");

export async function weekGames(weekNum: number, sport: DuelSport = "nfl"): Promise<GameRow[]> {
  const db = await admin();
  const cols =
    sport === "cfb"
      ? "id, week_num, away, home, slot, sort_order, away_score, home_score, kickoff, state, away_rank, home_rank, away_logo, home_logo"
      : "id, week_num, away, home, slot, sort_order, away_score, home_score, kickoff, state";
  const { data, error } = await db
    .from(gamesTable(sport))
    .select(cols)
    .eq("week_num", weekNum)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GameRow[];
}

export function weekLocked(games: GameRow[]): boolean {
  const first = games
    .map((g) => (g.kickoff ? new Date(g.kickoff).getTime() : Infinity))
    .sort((a, b) => a - b)[0];
  return first != null && Number.isFinite(first) && Date.now() >= first;
}

export function lockLabel(games: GameRow[]): string | null {
  const times = games
    .map((g) => (g.kickoff ? new Date(g.kickoff).getTime() : null))
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  return times[0] ? new Date(times[0]).toISOString() : null;
}

/** The tiebreaker is the last game of the week by kickoff. */
export function tiebreakerGame(games: GameRow[]): GameRow | null {
  const sorted = [...games].sort((a, b) => {
    const ak = a.kickoff ? new Date(a.kickoff).getTime() : 0;
    const bk = b.kickoff ? new Date(b.kickoff).getTime() : 0;
    if (ak !== bk) return ak - bk;
    return a.sort_order - b.sort_order;
  });
  return sorted[sorted.length - 1] ?? null;
}

/** Combined score of the tiebreaker game once it is final. */
export function tiebreakerTotal(games: GameRow[]): number | null {
  const g = tiebreakerGame(games);
  if (!g || g.state !== "post" || g.home_score == null || g.away_score == null) return null;
  return g.home_score + g.away_score;
}

function winnerOf(g: GameRow): Side | "tie" | null {
  if (g.home_score == null || g.away_score == null || g.state !== "post") return null;
  if (g.home_score === g.away_score) return "tie";
  return g.home_score > g.away_score ? "home" : "away";
}

export function scorePicks(games: GameRow[], picks: Record<string, Side>): number {
  let correct = 0;
  for (const g of games) {
    const w = winnerOf(g);
    if (w && w !== "tie" && picks[g.id] === w) correct += 1;
  }
  return correct;
}

function stableVariant(value: string, count: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % count;
}

function pickLine(lines: readonly string[], gameId: string) {
  return lines[stableVariant(gameId, lines.length)] ?? lines[0] ?? "The Gods have spoken.";
}

/** A deterministic proclamation that always names the team The Gods actually picked. */
export function godsCommentaryForGame(
  game: GameRow,
  side: Side,
  sport: DuelSport = "nfl",
  gap = 0,
) {
  const chosen = side === "home" ? game.home : game.away;
  const other = side === "home" ? game.away : game.home;
  const chosenRank = side === "home" ? game.home_rank : game.away_rank;
  const otherRank = side === "home" ? game.away_rank : game.home_rank;
  const homeField = side === "home";

  const rankedLines = [
    `The heavens favor No. ${chosenRank} ${chosen}. ${other} enter the arena beneath a gathering storm.`,
    `No. ${chosenRank} ${chosen} carry the decree of Olympus. ${other} are standing beneath the thunderbolt.`,
    `The poll gives No. ${chosenRank} ${chosen} a number. The Gods give them dominion over ${other}.`,
  ];
  const upsetLines = [
    `The rankings bow to no prophecy. ${chosen} will topple No. ${otherRank} ${other} and shake the heavens.`,
    `Let mortals trust the poll. The Gods summon ${chosen} to bring down No. ${otherRank} ${other}.`,
    `An upset has been written among the stars: ${chosen} over No. ${otherRank} ${other}.`,
  ];
  const commandingLines = [
    `${chosen} arrive with thunder in their hands. ${other} will hear the gates of Olympus close behind them.`,
    `The verdict is carved in stone: ${chosen}. ${other} are merely next in the path of the storm.`,
    `${chosen} have been chosen by the throne. ${other} can plead their case to the echoes.`,
    `The sky splits for ${chosen}. By nightfall, ${other} will know why mortals fear the Gods.`,
  ];
  const closeLines = [
    `A razor-thin prophecy, but prophecy nonetheless: ${chosen} survive ${other} when the final horn sounds.`,
    `Chaos clouds this battle. The Gods see one name beyond the smoke: ${chosen}.`,
    `${other} will make this a war. ${chosen} will make it legend.`,
    `The scales tremble, then fall toward ${chosen}. Fate denies ${other} by the narrowest measure.`,
    `No mortal should wager calmly here. The Gods still command: ${chosen}.`,
  ];
  const homeLines = [
    `On their own ground, ${chosen} summon the storm. ${other} have entered the wrong temple.`,
    `The faithful will roar, the earth will answer, and ${chosen} will cast down ${other}.`,
    `${chosen} defend sacred ground tonight. ${other} leave with nothing but the lesson.`,
  ];

  if (sport === "cfb" && chosenRank && otherRank && otherRank < chosenRank) {
    return pickLine(upsetLines, game.id);
  }
  if (sport === "cfb" && chosenRank) {
    return pickLine(rankedLines, game.id);
  }
  if (gap > 0.22) return pickLine(commandingLines, game.id);
  if (homeField && gap > 0.08) return pickLine(homeLines, game.id);
  return pickLine(closeLines, game.id);
}

/** The Gods pick on season form, poll rank and home field, with a line of trash talk. */
export async function buildGodsPicks(weekNum: number, games: GameRow[], sport: DuelSport = "nfl") {
  const db = await admin();
  const { data } = await db
    .from(gamesTable(sport))
    .select("away, home, away_score, home_score, state, week_num")
    .lt("week_num", weekNum)
    .eq("state", "post");

  const form = new Map<string, { w: number; l: number }>();
  const bump = (team: string, win: boolean) => {
    const row = form.get(team) ?? { w: 0, l: 0 };
    if (win) row.w += 1;
    else row.l += 1;
    form.set(team, row);
  };
  for (const g of data ?? []) {
    if (g.home_score == null || g.away_score == null || g.home_score === g.away_score) continue;
    const homeWon = g.home_score > g.away_score;
    bump(g.home, homeWon);
    bump(g.away, !homeWon);
  }
  const rate = (team: string) => {
    const row = form.get(team);
    if (!row || row.w + row.l === 0) return 0.5;
    return row.w / (row.w + row.l);
  };

  // College adds the AP poll: a top ranking is worth more than a tidy record.
  const pollWeight = (rank: number | null | undefined) => (rank && rank > 0 ? (26 - rank) / 50 : 0);

  const picks: Record<string, Side> = {};
  const reasoning: Record<string, string> = {};
  for (const g of games) {
    const homeScore = rate(g.home) + 0.08 + (sport === "cfb" ? pollWeight(g.home_rank) : 0);
    const awayScore = rate(g.away) + (sport === "cfb" ? pollWeight(g.away_rank) : 0);
    const side: Side = homeScore >= awayScore ? "home" : "away";
    picks[g.id] = side;
    const gap = Math.abs(homeScore - awayScore);
    reasoning[g.id] = godsCommentaryForGame(g, side, sport, gap);
  }
  // The Gods guess the tiebreaker from the average combined score so far.
  const totals = (data ?? [])
    .filter((g) => g.home_score != null && g.away_score != null)
    .map((g) => (g.home_score as number) + (g.away_score as number));
  const fallback = sport === "cfb" ? 55 : 45;
  const tiebreaker = totals.length
    ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
    : fallback;

  return { picks, reasoning, tiebreaker };
}

async function usernames(ids: string[]): Promise<Map<string, string>> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return new Map();
  const db = await admin();
  const { data } = await db.from("profiles").select("id, username").in("id", clean);
  return new Map((data ?? []).map((p) => [p.id, p.username]));
}

export type DuelRow = {
  id: string;
  week_num: number;
  sport: string;
  challenger_id: string;
  opponent_id: string | null;
  vs_gods: boolean;
  status: string;
  winner_id: string | null;
  gods_won: boolean;
  challenger_correct: number;
  opponent_correct: number;
};

const DUEL_COLS =
  "id, week_num, sport, challenger_id, opponent_id, vs_gods, status, winner_id, gods_won, challenger_correct, opponent_correct";

/** Grades every finished duel for a week and updates head-to-head records. */
export async function settleWeek(weekNum: number, sport: DuelSport = "nfl") {
  const db = await admin();
  const games = await weekGames(weekNum, sport);
  if (games.length === 0) return;
  const allFinal = games.every((g) => g.state === "post");
  if (!allFinal) return;

  const { data: duels } = await db
    .from("duels")
    .select(DUEL_COLS)
    .eq("week_num", weekNum)
    .eq("sport", sport)
    .eq("status", "active");
  if (!duels || duels.length === 0) return;

  for (const duel of duels as DuelRow[]) {
    const { data: rows } = await db
      .from("duel_picks")
      .select("user_id, picks, tiebreaker")
      .eq("duel_id", duel.id);
    const rowFor = (uid: string | null) => (rows ?? []).find((r) => r.user_id === uid);
    const pickFor = (uid: string | null) => (rowFor(uid)?.picks ?? {}) as Record<string, Side>;

    const opponentKey = duel.vs_gods ? null : duel.opponent_id;
    const challengerCorrect = scorePicks(games, pickFor(duel.challenger_id));
    const opponentCorrect = scorePicks(games, pickFor(opponentKey));

    let winnerId: string | null = null;
    let godsWon = false;
    let challengerAhead: boolean | null = null;
    if (challengerCorrect > opponentCorrect) challengerAhead = true;
    else if (opponentCorrect > challengerCorrect) challengerAhead = false;
    else {
      // Level on picks: the final game's combined score settles it.
      const actual = tiebreakerTotal(games);
      const diff = (guess: number | null | undefined) =>
        actual != null && guess != null ? Math.abs(guess - actual) : Infinity;
      const cDiff = diff(rowFor(duel.challenger_id)?.tiebreaker as number | null);
      const oDiff = diff(rowFor(opponentKey)?.tiebreaker as number | null);
      if (cDiff < oDiff) challengerAhead = true;
      else if (oDiff < cDiff) challengerAhead = false;
    }

    if (challengerAhead === true) winnerId = duel.challenger_id;
    else if (challengerAhead === false) {
      if (duel.vs_gods) godsWon = true;
      else winnerId = duel.opponent_id;
    }

    await db
      .from("duels")
      .update({
        status: "final",
        winner_id: winnerId,
        gods_won: godsWon,
        challenger_correct: challengerCorrect,
        opponent_correct: opponentCorrect,
        settled_at: new Date().toISOString(),
      })
      .eq("id", duel.id)
      .eq("status", "active");

    const tie = !winnerId && !godsWon;
    const participants = [duel.challenger_id, duel.vs_gods ? null : duel.opponent_id].filter(
      (id): id is string => Boolean(id),
    );
    for (const uid of participants) {
      const result = tie ? "tie" : winnerId === uid ? "win" : "loss";
      await bumpRecord(uid, result, duel.vs_gods && result === "win");
    }
  }
}

async function bumpRecord(userId: string, result: "win" | "loss" | "tie", beatGods: boolean) {
  const db = await admin();
  const { data: existing } = await db
    .from("duel_records")
    .select("user_id, wins, losses, ties, streak, best_streak, gods_wins")
    .eq("user_id", userId)
    .maybeSingle();

  const row = existing ?? {
    user_id: userId,
    wins: 0,
    losses: 0,
    ties: 0,
    streak: 0,
    best_streak: 0,
    gods_wins: 0,
  };
  const streak =
    result === "win" ? Math.max(0, row.streak) + 1 : result === "loss" ? 0 : row.streak;
  await db.from("duel_records").upsert({
    user_id: userId,
    wins: row.wins + (result === "win" ? 1 : 0),
    losses: row.losses + (result === "loss" ? 1 : 0),
    ties: row.ties + (result === "tie" ? 1 : 0),
    streak,
    best_streak: Math.max(row.best_streak, streak),
    gods_wins: row.gods_wins + (beatGods ? 1 : 0),
  });
}

export async function duelViews(userId: string, weekNum: number, sport: DuelSport = "nfl") {
  const db = await admin();
  const games = await weekGames(weekNum, sport);
  const locked = weekLocked(games);

  const { data: duels } = await db
    .from("duels")
    .select(`${DUEL_COLS}, created_at`)
    .eq("week_num", weekNum)
    .eq("sport", sport)
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = (duels ?? []) as (DuelRow & { created_at: string })[];
  const names = await usernames(rows.flatMap((d) => [d.challenger_id, d.opponent_id ?? ""]));

  const { data: pickRows } = await db
    .from("duel_picks")
    .select("duel_id, user_id, picks, reasoning, tiebreaker")
    .in("duel_id", rows.length ? rows.map((d) => d.id) : ["none"]);

  const rowFor = (duelId: string, uid: string | null) =>
    (pickRows ?? []).find((r) => r.duel_id === duelId && r.user_id === uid);
  const picksOf = (duelId: string, uid: string | null) =>
    (rowFor(duelId, uid)?.picks ?? {}) as Record<string, Side>;
  const tiebreakerOf = (duelId: string, uid: string | null) =>
    (rowFor(duelId, uid)?.tiebreaker ?? null) as number | null;

  const tbGame = tiebreakerGame(games);
  const tbTotal = tiebreakerTotal(games);

  return rows.map((d) => {
    const mine =
      d.challenger_id === userId ? "challenger" : d.opponent_id === userId ? "opponent" : null;
    const challengerPicks = picksOf(d.id, d.challenger_id);
    const opponentPicks = picksOf(d.id, d.vs_gods ? null : d.opponent_id);
    // Generate reveal copy from the stored pick itself. This keeps old duels
    // accurate even if their original commentary was stale or inconsistent.
    const godsReasoning = d.vs_gods
      ? Object.fromEntries(
          games.flatMap((game) => {
            const side = opponentPicks[game.id];
            return side ? [[game.id, godsCommentaryForGame(game, side, sport)]] : [];
          }),
        )
      : {};
    const reveal = locked || d.status === "final";
    const challengerTb = tiebreakerOf(d.id, d.challenger_id);
    const opponentTb = tiebreakerOf(d.id, d.vs_gods ? null : d.opponent_id);
    return {
      tiebreakerGameId: tbGame?.id ?? null,
      tiebreakerLabel: tbGame ? `${tbGame.away} at ${tbGame.home}` : null,
      tiebreakerTotal: tbTotal,
      id: d.id,
      weekNum: d.week_num,
      sport: (d.sport === "cfb" ? "cfb" : "nfl") as DuelSport,
      status: d.status,
      vsGods: d.vs_gods,
      createdAt: d.created_at,
      mySide: mine,
      challenger: {
        userId: d.challenger_id,
        username: names.get(d.challenger_id) ?? "Player",
        picks: reveal || mine === "challenger" ? challengerPicks : {},
        picked: Object.keys(challengerPicks).length,
        correct: d.status === "final" ? d.challenger_correct : scorePicks(games, challengerPicks),
        isGods: false,
        reasoning: {} as Record<string, string>,
        tiebreaker: reveal || mine === "challenger" ? challengerTb : null,
      },
      opponent: {
        userId: d.vs_gods ? null : d.opponent_id,
        username: d.vs_gods
          ? "The Gods"
          : d.opponent_id
            ? (names.get(d.opponent_id) ?? "Player")
            : "Open seat",
        picks: reveal || mine === "opponent" ? opponentPicks : {},
        picked: Object.keys(opponentPicks).length,
        correct: d.status === "final" ? d.opponent_correct : scorePicks(games, opponentPicks),
        isGods: d.vs_gods,
        // The Gods only talk once the slate is locked, so nobody can copy them.
        reasoning: d.vs_gods && reveal ? godsReasoning : ({} as Record<string, string>),
        tiebreaker: reveal || mine === "opponent" ? opponentTb : null,
      },
      winnerId: d.winner_id,
      godsWon: d.gods_won,
    };
  });
}
