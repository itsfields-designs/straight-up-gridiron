import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  computeStandings,
  fetchAllWeeks,
  fetchPickEntries,
  type Member,
} from "@/lib/pool";

export function StandingsPanel({
  leagueId,
  week,
  members,
}: {
  leagueId: string;
  week: number;
  members: Member[];
}) {
  const [mode, setMode] = useState<"season" | "week">("season");

  const schedule = useQuery({ queryKey: ["all-weeks"], queryFn: fetchAllWeeks });
  const entries = useQuery({
    queryKey: ["picks", leagueId, "all"],
    queryFn: () => fetchPickEntries(leagueId),
  });

  const loading = schedule.isLoading || entries.isLoading;

  const weeks = (schedule.data?.weeks ?? []).filter((w) =>
    mode === "week" ? w.week_num === week : true,
  );
  const games = (schedule.data?.games ?? []).filter((g) =>
    mode === "week" ? g.week_num === week : true,
  );
  const rows = loading
    ? []
    : computeStandings(members, weeks, games, entries.data ?? []);

  return (
    <div>
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Calculating standings…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Rank</th>
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-right font-medium">Record</th>
                <th className="px-4 py-2.5 text-right font-medium">Tiebreaker Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{r.username}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.correct}-{r.missed}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.tbDiff ?? "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-faint">
                    No results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-faint">
        Ranked by most correct picks; the total-points guess on the tiebreaker game (smallest
        difference from the actual combined score) breaks ties.
      </p>
    </div>
  );
}
