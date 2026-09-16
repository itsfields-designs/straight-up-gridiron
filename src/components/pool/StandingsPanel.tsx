import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchPayouts, fetchStandings, money, type League } from "@/lib/pool";

export function StandingsPanel({ leagueId, week, league }: { leagueId: string; week: number; league?: League }) {
  const [mode, setMode] = useState<"season" | "week">("season");
  const weekNum = mode === "season" ? 0 : week;

  const standings = useQuery({
    queryKey: ["standings", leagueId, weekNum],
    queryFn: () => fetchStandings(leagueId, weekNum),
  });
  const payouts = useQuery({ queryKey: ["payouts", leagueId], queryFn: () => fetchPayouts(leagueId) });

  const rows = standings.data ?? [];
  const updatedAt = rows[0]?.updatedAt;
  const wonBy = new Map<string, number>();
  for (const p of payouts.data ?? []) {
    if (mode === "week" && !(p.potType === "weekly" && p.weekNum === week)) continue;
    wonBy.set(p.userId, (wonBy.get(p.userId) ?? 0) + p.amount);
  }

  return (
    <div>
      {league && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Entry fee", value: league.entry_fee },
            { label: "Weekly pot", value: league.weekly_pot },
            { label: "Season pot", value: league.season_pot },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-3.5">
              <div className="text-xs text-faint">{c.label}</div>
              <div className="font-display text-lg font-medium">{money(c.value)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex w-fit gap-1 rounded-md bg-secondary p-1">
        {(["season", "week"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded px-3.5 py-1.5 text-sm font-medium ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m === "season" ? "Season" : `Week ${week}`}
          </button>
        ))}
      </div>

      {standings.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading standings…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Rank</th>
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-right font-medium">Record</th>
                <th className="px-4 py-2.5 text-right font-medium">Tiebreaker Δ</th>
                <th className="px-4 py-2.5 text-right font-medium">Won</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.userId}-${r.entryNo}`} className="border-t border-border">
                  <td className="px-4 py-2.5 text-muted-foreground">{r.rank}</td>
                  <td className="px-4 py-2.5 font-medium">{r.username}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.correct}-{r.missed}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.tbDiff ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(wonBy.get(r.userId) ?? 0)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-faint">
                    No results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-faint">
        Standings update on their own as final scores come in. Ranked by most correct picks; the
        total-points guess on the tiebreaker game breaks ties.
        {updatedAt ? ` Last updated ${new Date(updatedAt).toLocaleString()}.` : ""}
      </p>
    </div>
  );
}
