import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Percent } from "lucide-react";

import {
  entryLabel,
  fetchMembers,
  fetchPickEntries,
  fetchStandings,
  type League,
} from "@/lib/pool";
import { fetchLeagueWeek } from "@/lib/league-sport";
import { decidedCorrect, pct, simulateOdds, undecidedGames, type OddsEntry } from "@/lib/odds";

export function OddsPanel({
  leagueId,
  league,
  week,
  mode,
  currentUserId,
}: {
  leagueId: string;
  league: League;
  week: number;
  mode: "week" | "season";
  currentUserId?: string | undefined;
}) {
  const sport = league.sport ?? "nfl";
  const weekData = useQuery({
    queryKey: ["week", sport, week],
    queryFn: () => fetchLeagueWeek(sport, week),
  });
  const entries = useQuery({
    queryKey: ["pick-entries", leagueId, week],
    queryFn: () => fetchPickEntries(leagueId, week),
  });
  const members = useQuery({ queryKey: ["members", leagueId], queryFn: () => fetchMembers(leagueId) });
  const weekStandings = useQuery({
    queryKey: ["standings", leagueId, week],
    queryFn: () => fetchStandings(leagueId, week),
  });
  const seasonStandings = useQuery({
    queryKey: ["standings", leagueId, 0],
    queryFn: () => fetchStandings(leagueId, 0),
  });

  const games = weekData.data?.games ?? [];
  const remaining = useMemo(() => undecidedGames(games), [games]);

  const rows = useMemo(() => {
    if (!games.length) return [];
    const nameOf = new Map((members.data ?? []).map((m) => [m.user_id, m.username]));
    const tbOf = new Map(
      (weekStandings.data ?? []).map((r) => [`${r.userId}:${r.entryNo}`, r.tbDiff]),
    );
    const list = new Map<string, OddsEntry>();

    for (const e of entries.data ?? []) {
      const key = `${e.user_id}:${e.entry_no}`;
      list.set(key, {
        key,
        label: entryLabel(nameOf.get(e.user_id) ?? "Player", e.entry_no),
        base: decidedCorrect(games, e.picks),
        tbDiff: tbOf.get(key) ?? null,
        picks: e.picks,
      });
    }

    if (mode === "season") {
      for (const r of seasonStandings.data ?? []) {
        const key = `${r.userId}:${r.entryNo}`;
        const existing = list.get(key);
        list.set(key, {
          key,
          label: r.username,
          base: r.correct,
          tbDiff: r.tbDiff,
          picks: existing?.picks ?? {},
        });
      }
    }

    const all = Array.from(list.values());
    if (!all.length) return [];
    return simulateOdds(all, remaining).sort(
      (a, b) => b.first - a.first || b.second - a.second || b.third - a.third || b.base - a.base,
    );
  }, [games, remaining, entries.data, members.data, weekStandings.data, seasonStandings.data, mode]);

  const loading =
    weekData.isLoading || entries.isLoading || members.isLoading || weekStandings.isLoading ||
    (mode === "season" && seasonStandings.isLoading);

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
          <Percent size={15} />
        </span>
        <div>
          <h3 className="text-sm font-semibold">
            Chances of Finishing Top 3
          </h3>
          <p className="text-xs text-faint">
            {mode === "season"
              ? "Season race, counting every game still to play this week."
              : `Week ${week} race, with ${remaining.length} game${remaining.length === 1 ? "" : "s"} left.`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Working out the odds…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-faint">
          Odds appear once picks are in for this week.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                currentUserId && r.key.startsWith(`${currentUserId}:`)
                  ? "border-accent bg-accent/10"
                  : "border-border"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.label}</p>
                <p className="text-xs text-faint tabular-nums">
                  {r.base} correct · best case {r.ceiling}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{pct(r.first)}</p>
                <p className="text-xs text-faint">1st</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{pct(r.second)}</p>
                <p className="text-xs text-faint">2nd</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{pct(r.third)}</p>
                <p className="text-xs text-faint">3rd</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-faint">
        Every game still to play is treated as a coin flip, and the tiebreaker guess settles ties
        when scores are known. Odds refresh as results come in.
      </p>
    </section>
  );
}
