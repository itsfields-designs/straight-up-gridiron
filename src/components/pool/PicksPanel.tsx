import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { fetchPickEntries, fetchWeek, gradeGame, savePicks, type Side } from "@/lib/pool";

export function PicksPanel({
  leagueId,
  week,
  userId,
}: {
  leagueId: string;
  week: number;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const weekQuery = useQuery({ queryKey: ["week", week], queryFn: () => fetchWeek(week) });
  const entriesQuery = useQuery({
    queryKey: ["picks", leagueId, week],
    queryFn: () => fetchPickEntries(leagueId, week),
  });

  const [picks, setPicks] = useState<Record<string, Side>>({});
  const [tiebreaker, setTiebreaker] = useState("");

  const mine = entriesQuery.data?.find((e) => e.user_id === userId);
  useEffect(() => {
    setPicks(mine?.picks ?? {});
    setTiebreaker(mine?.tiebreaker != null ? String(mine.tiebreaker) : "");
  }, [mine, week]);

  const save = useMutation({
    mutationFn: () =>
      savePicks({
        leagueId,
        weekNum: week,
        userId,
        picks,
        tiebreaker: tiebreaker === "" ? null : Number(tiebreaker),
      }),
    onSuccess: () => {
      toast.success("Picks saved");
      queryClient.invalidateQueries({ queryKey: ["picks", leagueId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (weekQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading matchups…</p>;

  const weekData = weekQuery.data?.week;
  const games = weekQuery.data?.games ?? [];

  if (!weekData || games.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No schedule has been entered for Week {week} yet. Any member can add it under "Schedule &
          results".
        </p>
      </div>
    );
  }

  const picked = Object.keys(picks).length;
  const canSubmit = picked === games.length && tiebreaker !== "" && !isNaN(Number(tiebreaker));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {picked} of {games.length} games picked
          {weekData.locked && (
            <span className="ml-2 text-destructive">· picks are locked for this week</span>
          )}
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={!canSubmit || weekData.locked || save.isPending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          Save my picks
        </button>
      </div>

      <div className="space-y-2.5">
        {games.map((game) => {
          const isTb = game.id === weekData.tiebreaker_game_id;
          const winner = gradeGame(game);
          return (
            <div key={game.id} className="rounded-lg border border-border bg-card p-3.5">
              <div className="mb-2 flex items-center gap-2 text-xs text-faint">
                <span>{game.slot}</span>
                {isTb && (
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent-soft-foreground">
                    Tiebreaker game
                  </span>
                )}
                {winner && winner !== "tie" && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
                    Final {game.away_score}–{game.home_score}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["away", "home"] as const).map((side) => {
                  const chosen = picks[game.id] === side;
                  const isWinner = winner === side;
                  const wrong = chosen && winner && winner !== "tie" && winner !== side;
                  return (
                    <button
                      key={side}
                      disabled={weekData.locked}
                      onClick={() => setPicks((p) => ({ ...p, [game.id]: side }))}
                      className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm font-medium ${
                        chosen
                          ? "border-accent bg-accent-soft text-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <span>
                        {game[side]}
                        {side === "home" && <span className="font-normal text-faint"> (home)</span>}
                      </span>
                      {isWinner && <Check size={15} className="text-success" />}
                      {wrong && <X size={15} className="text-destructive" />}
                    </button>
                  );
                })}
              </div>
              {isTb && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-sm text-muted-foreground" htmlFor="tb">
                    Combined final score, both teams:
                  </label>
                  <input
                    id="tb"
                    type="number"
                    disabled={weekData.locked}
                    value={tiebreaker}
                    onChange={(e) => setTiebreaker(e.target.value)}
                    placeholder="33"
                    className="w-24 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
