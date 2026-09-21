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
  third: number;
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
 * Monte Carlo odds of finishing 1st, 2nd and 3rd. Every remaining game is treated as
 * a coin flip; ties are settled by the tiebreaker guess when both are known and
 * split evenly otherwise.
 */
export function simulateOdds(entries: OddsEntry[], remaining: Game[], sims = 4000): OddsRow[] {
  const n = entries.length;
  const first = new Array<number>(n).fill(0);
  const second = new Array<number>(n).fill(0);
  const third = new Array<number>(n).fill(0);
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

    // Each group of genuinely tied entries is equally likely to fill any of
    // the ranks it spans, so award each rank in the span a 1/size share.
    let rank = 1;
    for (const group of groups) {
      if (rank > 3) break;
      const share = 1 / group.length;
      for (const idx of group) {
        if (rank <= 1 && rank + group.length - 1 >= 1) first[idx] = (first[idx] ?? 0) + share;
        if (rank <= 2 && rank + group.length - 1 >= 2) second[idx] = (second[idx] ?? 0) + share;
        if (rank <= 3 && rank + group.length - 1 >= 3) third[idx] = (third[idx] ?? 0) + share;
      }
      rank += group.length;
    }
  }

  return entries.map((e, i) => ({
    key: e.key,
    label: e.label,
    base: e.base,
    ceiling: e.base + remaining.filter((g) => e.picks[g.id]).length,
    first: (first[i] ?? 0) / runs,
    second: (second[i] ?? 0) / runs,
    third: (third[i] ?? 0) / runs,
  }));
}

export function pct(v: number) {
  if (v <= 0) return "0%";
  if (v >= 0.9995) return "100%";
  if (v < 0.01) return "<1%";
  return `${Math.round(v * 100)}%`;
}
