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
        <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Entry fee", value: league.entry_fee },
            { label: "Weekly pot", value: league.weekly_pot },
            { label: "Season pot", value: league.season_pot },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-3 sm:p-3.5">
              <div className="text-[0.7rem] text-faint sm:text-xs">{c.label}</div>
              <div className="font-display text-base font-medium sm:text-lg">{money(c.value)}</div>
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
        <>
          <ul className="grid gap-2 sm:hidden">
            {rows.map((r) => (
              <li
                key={`${r.userId}-${r.entryNo}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-sm font-semibold tabular-nums">
                  {r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.username}</p>
                  <p className="text-xs text-faint">
                    Set {r.entryNo} · tiebreaker {r.tbDiff ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums">
                    {r.correct}-{r.missed}
                  </p>
                  <p className="text-xs text-faint tabular-nums">{money(wonBy.get(r.userId) ?? 0)}</p>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-faint">
                No results yet.
              </li>
            )}
          </ul>

          <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
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
        </>
      )}
      <p className="mt-3 text-xs text-faint">
        Standings update on their own as final scores come in. Ranked by most correct picks; the
        total-points guess on the tiebreaker game breaks ties.
        {updatedAt ? ` Last updated ${new Date(updatedAt).toLocaleString()}.` : ""}
      </p>
    </div>
  );
}
