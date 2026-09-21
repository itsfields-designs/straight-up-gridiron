import { gradeGame, type Game, type Side } from "@/lib/pool";

export type OddsEntry = {
  key: string;
  label: string;
  /** Wins already banked (decided games, or the stored season total). */
  base: number;
  tbDiff: number | null;
  picks: Record<string, Side>;
};

export type OddsRow = {
  key: string;
  label: string;
  base: number;
  /** Best possible finishing total if every remaining pick hits. */
  ceiling: number;
  first: number;
  second: number;
};

/** Games in a week that have no winner yet. */
export function undecidedGames(games: Game[]): Game[] {
  return games.filter((g) => gradeGame(g) == null);
}

/** Wins already locked in from the games that have finished. */
export function decidedCorrect(games: Game[], picks: Record<string, Side>): number {
  let correct = 0;
  for (const game of games) {
    const winner = gradeGame(game);
    if (!winner || winner === "tie") continue;
    if (picks[game.id] === winner) correct++;
  }
  return correct;
}

const TB_LAST = Number.POSITIVE_INFINITY;

/**
 * Monte Carlo odds of finishing 1st and 2nd. Every remaining game is treated as
 * a coin flip; ties are settled by the tiebreaker guess when both are known and
 * split evenly otherwise.
 */
export function simulateOdds(entries: OddsEntry[], remaining: Game[], sims = 4000): OddsRow[] {
  const n = entries.length;
  const first = new Array<number>(n).fill(0);
  const second = new Array<number>(n).fill(0);
  const tb = entries.map((e) => (e.tbDiff == null ? TB_LAST : e.tbDiff));
  const runs = remaining.length === 0 ? 1 : sims;

  const scores = new Array<number>(n).fill(0);
  const order = Array.from({ length: n }, (_, i) => i);

  for (let s = 0; s < runs; s++) {
    const winners = new Map<string, Side>();
    for (const g of remaining) winners.set(g.id, Math.random() < 0.5 ? "home" : "away");

    for (let i = 0; i < n; i++) {
      let score = entries[i]!.base;
      const picks = entries[i]!.picks;
      for (const g of remaining) if (picks[g.id] === winners.get(g.id)) score++;
      scores[i] = score;
    }

    order.sort((a, b) => scores[b]! - scores[a]! || tb[a]! - tb[b]!);

    // Group entries that are genuinely tied (same score and same tiebreaker gap).
    const groups: number[][] = [];
    for (const idx of order) {
      const last = groups[groups.length - 1];
      const prev = last?.[0];
      if (last && prev != null && scores[prev] === scores[idx] && tb[prev] === tb[idx]) last.push(idx);
      else groups.push([idx]);
    }

    const g1 = groups[0] ?? [];
    if (g1.length === 1) {
      first[g1[0]!] = (first[g1[0]!] ?? 0) + 1;
      const g2 = groups[1] ?? [];
      for (const idx of g2) second[idx] = (second[idx] ?? 0) + 1 / g2.length;
    } else {
      for (const idx of g1) {
        first[idx] = (first[idx] ?? 0) + 1 / g1.length;
        second[idx] = (second[idx] ?? 0) + 1 / g1.length;
      }
    }
  }

  return entries.map((e, i) => ({
    key: e.key,
    label: e.label,
    base: e.base,
    ceiling: e.base + remaining.filter((g) => e.picks[g.id]).length,
    first: (first[i] ?? 0) / runs,
    second: (second[i] ?? 0) / runs,
  }));
}

export function pct(v: number) {
  if (v <= 0) return "0%";
  if (v >= 0.9995) return "100%";
  if (v < 0.01) return "<1%";
  return `${Math.round(v * 100)}%`;
}
