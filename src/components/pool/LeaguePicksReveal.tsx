import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Eye, X } from "lucide-react";
import { fetchMembers, gradeGame, type Game, type PickEntry } from "@/lib/pool";

function shortTeam(name: string) {
  return name.replace(/^#\d+\s+/, "");
}

/** Everyone's picks for a locked week. */
export function LeaguePicksReveal({
  leagueId,
  week,
  games,
  entries,
  userId,
}: {
  leagueId: string;
  week: number;
  games: Game[];
  entries: PickEntry[];
  userId: string;
}) {
  const membersQuery = useQuery({
    queryKey: ["members", leagueId],
    queryFn: () => fetchMembers(leagueId),
  });
  const [open, setOpen] = useState<string | null>(null);

  const nameOf = (id: string) =>
    membersQuery.data?.find((m) => m.user_id === id)?.username ?? "Member";

  const rows = entries
    .filter((e) => e.week_num === week)
    .sort((a, b) =>
      nameOf(a.user_id).localeCompare(nameOf(b.user_id)) || a.entry_no - b.entry_no,
    );

  if (rows.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 font-display text-2xl font-semibold">
        <Eye size={13} /> Everyone's picks · Week {week}
      </h3>
      <div className="space-y-2">
        {rows.map((entry) => {
          const key = `${entry.user_id}-${entry.entry_no}`;
          const isOpen = open === key;
          const mine = entry.user_id === userId;
          let correct = 0;
          let decided = 0;
          for (const g of games) {
            const winner = gradeGame(g);
            if (!winner || winner === "tie") continue;
            decided += 1;
            if (entry.picks[g.id] === winner) correct += 1;
          }
          return (
            <div key={key} className="overflow-hidden rounded-xl border border-border-strong bg-card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="flex min-h-13 w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {nameOf(entry.user_id)}
                  {entry.entry_no > 1 && (
                    <span className="ml-1 font-normal text-faint">Set {entry.entry_no}</span>
                  )}
                  {mine && <span className="ml-1.5 text-xs font-medium text-accent">You</span>}
                </span>
                {decided > 0 && (
                   <span className="shrink-0 rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-semibold tabular-nums">
                    {correct}/{decided}
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <ul className="border-t border-border px-3.5 py-2">
                  {games.map((g) => {
                    const side = entry.picks[g.id];
                    const winner = gradeGame(g);
                    const right = side && winner && winner !== "tie" && winner === side;
                    const wrong = side && winner && winner !== "tie" && winner !== side;
                    return (
                      <li
                        key={g.id}
                        className="flex items-center gap-2 border-b border-border/60 py-2 text-sm last:border-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs text-faint">
                          {shortTeam(g.away)} @ {shortTeam(g.home)}
                        </span>
                        <span className="shrink-0 font-medium">
                          {side ? shortTeam(g[side]) : "—"}
                        </span>
                        {right && <Check size={15} className="shrink-0 text-success" />}
                        {wrong && <X size={15} className="shrink-0 text-destructive" />}
                      </li>
                    );
                  })}
                  {entry.tiebreaker != null && (
                    <li className="pt-2 text-xs text-muted-foreground">
                      Tiebreaker guess: {entry.tiebreaker}
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
