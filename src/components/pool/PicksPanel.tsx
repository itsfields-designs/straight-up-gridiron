import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/feedback";

import {
  deletePickEntry,
  fetchPickEntries,
  fetchWeek,
  gradeGame,
  savePicks,
  type Side,
} from "@/lib/pool";

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
  const [savedPicks, setSavedPicks] = useState<Record<string, Side>>({});
  const [savedTiebreaker, setSavedTiebreaker] = useState("");
  const [activeEntry, setActiveEntry] = useState(1);
  const [draftSets, setDraftSets] = useState<number[]>([]);

  const myEntries = (entriesQuery.data ?? [])
    .filter((e) => e.user_id === userId)
    .sort((a, b) => a.entry_no - b.entry_no);

  const entryNos = Array.from(
    new Set([1, ...myEntries.map((e) => e.entry_no), ...draftSets]),
  ).sort((a, b) => a - b);

  useEffect(() => {
    setActiveEntry(1);
    setDraftSets([]);
  }, [week, leagueId]);

  const mine = myEntries.find((e) => e.entry_no === activeEntry);
  useEffect(() => {
    const p = mine?.picks ?? {};
    const t = mine?.tiebreaker != null ? String(mine.tiebreaker) : "";
    setPicks(p);
    setTiebreaker(t);
    setSavedPicks(p);
    setSavedTiebreaker(t);
  }, [mine, week, activeEntry]);

  const save = useMutation({
    mutationFn: () =>
      savePicks({
        leagueId,
        weekNum: week,
        userId,
        entryNo: activeEntry,
        picks,
        tiebreaker: tiebreaker === "" ? null : Number(tiebreaker),
      }),
    onSuccess: () => {
      toast.success(activeEntry > 1 ? `Set ${activeEntry} saved` : "Picks saved");
      setDraftSets((d) => d.filter((n) => n !== activeEntry));
      setSavedPicks(picks);
      setSavedTiebreaker(tiebreaker);
      queryClient.invalidateQueries({ queryKey: ["picks", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (entryNo: number) =>
      deletePickEntry({ leagueId, weekNum: week, userId, entryNo }),
    onSuccess: (_d, entryNo) => {
      toast.success(`Set ${entryNo} removed`);
      setDraftSets((d) => d.filter((n) => n !== entryNo));
      setActiveEntry(1);
      queryClient.invalidateQueries({ queryKey: ["picks", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (weekQuery.isLoading) return <LoadingState label="Loading matchups" />;

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
  const remaining = Math.max(games.length - picked, 0);
  const isDirty =
    JSON.stringify(picks) !== JSON.stringify(savedPicks) || tiebreaker !== savedTiebreaker;
  const saveHint = weekData.locked
    ? "Picks are locked for this week."
    : remaining > 0
      ? `${remaining} ${remaining === 1 ? "pick" : "picks"} remaining.`
      : tiebreaker === ""
        ? "Enter the tiebreaker score to save."
        : isDirty
          ? "Your set is ready to save."
          : "Your set is saved.";

  const addSet = () => {
    const next = Math.max(...entryNos) + 1;
    setDraftSets((d) => [...d, next]);
    setActiveEntry(next);
    setPicks({});
    setTiebreaker("");
    setSavedPicks({});
    setSavedTiebreaker("");
  };

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <div className="flex shrink-0 gap-1 rounded-md bg-secondary p-1" role="tablist" aria-label="Pick sets">
          {entryNos.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={activeEntry === n}
              onClick={() => setActiveEntry(n)}
              className={`min-h-11 shrink-0 rounded px-3.5 text-sm font-medium ${
                activeEntry === n ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Set {n}
              {myEntries.some((e) => e.entry_no === n) ? "" : " ·"}
            </button>
          ))}
        </div>
        <button
          onClick={addSet}
          disabled={weekData.locked}
          className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground disabled:opacity-40"
        >
          <Plus size={14} /> Add set
        </button>
        {activeEntry > 1 && (
          <button
            onClick={() => remove.mutate(activeEntry)}
            disabled={weekData.locked || remove.isPending}
            className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-destructive disabled:opacity-40"
          >
            <Trash2 size={14} /> Remove set {activeEntry}
          </button>
        )}
      </div>

      <div className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        Set {activeEntry} · {picked} of {games.length} games picked
        {weekData.locked && (
          <span className="ml-2 text-destructive">· picks are locked for this week</span>
        )}
        <p className="mt-1 text-xs text-faint">
          Each set stands on its own in the standings and costs one entry fee.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${games.length ? (picked / games.length) * 100 : 0}%` }} />
        </div>
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
                      type="button"
                      aria-pressed={chosen}
                      aria-label={`Pick ${game[side]}${side === "home" ? ", home team" : ", away team"}`}
                      disabled={weekData.locked}
                      onClick={() => setPicks((p) => ({ ...p, [game.id]: side }))}
                      className={`flex min-h-12 items-center justify-between gap-1 rounded-md border px-3 py-2.5 text-left text-sm font-medium ${
                        chosen
                          ? "border-accent bg-accent-soft text-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {game[side]}
                        {side === "home" && <span className="font-normal text-faint"> (home)</span>}
                      </span>
                      {isWinner && <Check size={15} className="shrink-0 text-success" />}
                      {wrong && <X size={15} className="shrink-0 text-destructive" />}
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
                    className="min-h-11 w-24 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mt-4 rounded-lg bg-background/95 py-2 backdrop-blur md:static md:bottom-auto md:bg-transparent md:py-0 md:backdrop-blur-none">
        <button
          onClick={() => save.mutate()}
          disabled={!canSubmit || weekData.locked || save.isPending}
          className="min-h-12 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-lg transition-opacity hover:opacity-85 disabled:opacity-40 md:w-auto md:shadow-none"
        >
          {save.isPending ? "Saving…" : `Save set ${activeEntry} · ${picked}/${games.length}`}
        </button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground md:text-left" aria-live="polite">{saveHint}</p>
      </div>
    </div>
  );
}
