import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchStandings } from "@/lib/pool";

export function StandingsPanel({ leagueId, week }: { leagueId: string; week: number }) {
  const [mode, setMode] = useState<"season" | "week">("season");
  const weekNum = mode === "season" ? 0 : week;

  const standings = useQuery({
    queryKey: ["standings", leagueId, weekNum],
    queryFn: () => fetchStandings(leagueId, weekNum),
  });

  const rows = standings.data ?? [];
  const updatedAt = rows[0]?.updatedAt;

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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="px-4 py-2.5 text-muted-foreground">{r.rank}</td>
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
        Standings update on their own as final scores come in. Ranked by most correct picks; the
        total-points guess on the tiebreaker game breaks ties.
        {updatedAt ? ` Last updated ${new Date(updatedAt).toLocaleString()}.` : ""}
      </p>
    </div>
  );
}
