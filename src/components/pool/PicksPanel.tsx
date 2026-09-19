import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/feedback";
import { TeamBadge } from "@/components/pool/TeamBadge";
import { NcaaPickDeadline, useNcaaWeekLocked } from "@/components/pool/NcaaPickDeadline";

import { fetchLeagueWeek } from "@/lib/league-sport";
import {
  deletePickEntry,
  fetchPickEntries,
  gradeGame,
  leagueGames,
  leagueWeekLocked,
  savePicks,
  skipsEarlyGames,
  type League,
  type Side,
} from "@/lib/pool";

export function PicksPanel({
  league,
  week,
  userId,
}: {
  league: League;
  week: number;
  userId: string;
}) {
  const leagueId = league.id;
  const isCollege = league.sport === "ncaa";
  const queryClient = useQueryClient();
  const weekQuery = useQuery({
    queryKey: ["week", league.sport, week],
    queryFn: () => fetchLeagueWeek(league.sport, week),
  });
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

  const weekData = weekQuery.data?.week;
  const allGames = weekQuery.data?.games ?? [];
  const games = leagueGames(allGames, league, week);
  const skipped = allGames.length - games.length;
  const collegeLocked = useNcaaWeekLocked(games, weekData?.locked);
  const locked = isCollege
    ? collegeLocked
    : leagueWeekLocked(games, weekData, league, week);

  if (weekQuery.isLoading) return <LoadingState label="Loading matchups" />;

  if (!weekData || games.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No matchups have loaded for Week {week} yet. Tap "Refresh now" under "Schedule &
          results".
        </p>
      </div>
    );
  }

  const picked = Object.keys(picks).length;
  const needsTiebreaker = Boolean(weekData.tiebreaker_game_id);
  const canSubmit =
    picked === games.length && (!needsTiebreaker || (tiebreaker !== "" && !isNaN(Number(tiebreaker))));
  const remaining = Math.max(games.length - picked, 0);
  const isDirty =
    JSON.stringify(picks) !== JSON.stringify(savedPicks) || tiebreaker !== savedTiebreaker;
  const saveHint = locked
    ? "Picks are locked for this week."
    : remaining > 0
      ? `${remaining} ${remaining === 1 ? "pick" : "picks"} remaining.`
      : needsTiebreaker && tiebreaker === ""
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

  const groups: { label: string; games: typeof games }[] = [];
  for (const g of games) {
    const label = g.kickoff
      ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
          new Date(g.kickoff),
        )
      : g.slot;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.games.push(g);
    else groups.push({ label, games: [g] });
  }

  const nextKick = games
    .map((g) => (g.kickoff ? new Date(g.kickoff).getTime() : 0))
    .filter((t) => t > Date.now())
    .sort((a, b) => a - b)[0];
  const lockLabel = nextKick
    ? `Locks ${new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(nextKick))}`
    : "Picks closed";

  const cleanCollegeName = (name: string) => name.replace(/^#\d+\s+/, "");

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <div
          className="flex shrink-0 gap-1 rounded-full bg-secondary p-1"
          role="tablist"
          aria-label="Pick sets"
        >
          {entryNos.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={activeEntry === n}
              onClick={() => setActiveEntry(n)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
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
          disabled={locked}
          className="flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3.5 text-sm font-medium text-muted-foreground disabled:opacity-40"
        >
          <Plus size={14} /> Add set
        </button>
        {activeEntry > 1 && (
          <button
            onClick={() => remove.mutate(activeEntry)}
            disabled={locked || remove.isPending}
            className="flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3.5 text-sm font-medium text-destructive disabled:opacity-40"
          >
            <Trash2 size={14} /> Remove set {activeEntry}
          </button>
        )}
      </div>

      {isCollege ? (
        <>
          <NcaaPickDeadline games={games} storedLocked={weekData.locked} />
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {picked} of {games.length} picked · Set {activeEntry}
          </p>
        </>
      ) : (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold">
                {locked ? "Picks are locked" : lockLabel}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                Set {activeEntry} · each set stands on its own and costs one entry fee.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-sm font-semibold tabular-nums">
              {picked}/{games.length}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${games.length ? (picked / games.length) * 100 : 0}%` }}
            />
          </div>
          {skipsEarlyGames(league, week) && skipped > 0 && (
            <p className="mt-2 text-xs text-faint">
              This league skips games before Sunday, so {skipped}{" "}
              {skipped === 1 ? "game is" : "games are"} left off.
            </p>
          )}
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.label}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              {group.label}
            </h3>
            <div className="space-y-2.5">
              {group.games.map((game) => {
                const isTb = game.id === weekData.tiebreaker_game_id;
                const winner = gradeGame(game);
                const unpicked = !picks[game.id];
                if (isCollege) {
                  return (
                    <article key={game.id} className="rounded-2xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between text-xs text-faint">
                        <span className="flex items-center gap-2">
                          {game.slot}
                          {isTb && (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-soft-foreground">
                              Tiebreaker
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          {locked && <Lock size={11} />}
                          {game.state === "post" ? "Final" : game.state === "in" ? "Live" : "Scheduled"}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(["away", "home"] as const).map((side) => {
                          const chosen = picks[game.id] === side;
                          const isWinner = winner === side;
                          const wrong = chosen && winner && winner !== "tie" && winner !== side;
                          const logo = side === "away" ? game.away_logo : game.home_logo;
                          const rank = side === "away" ? game.away_rank : game.home_rank;
                          const score = side === "away" ? game.away_score : game.home_score;
                          const team = cleanCollegeName(game[side]);
                          return (
                            <button
                              key={side}
                              type="button"
                              aria-pressed={chosen}
                              aria-label={`Pick ${team}${side === "home" ? ", home team" : ", away team"}`}
                              disabled={locked}
                              onClick={() => setPicks((p) => ({ ...p, [game.id]: side }))}
                              className={`flex min-h-16 flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-70 ${
                                chosen ? "border-accent bg-accent-soft" : "border-border hover:bg-secondary"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {logo ? <img src={logo} alt="" className="h-5 w-5 object-contain" /> : null}
                                <span className="text-xs text-faint">
                                  {side === "away" ? "Away" : "Home"}
                                </span>
                              </span>
                              <span className="text-sm font-medium leading-tight">
                                {rank ? (
                                  <span className="mr-1 rounded bg-accent-soft px-1 py-0.5 text-[11px] font-bold text-accent-soft-foreground">
                                    #{rank}
                                  </span>
                                ) : null}
                                {team}
                                {isWinner && " ✓"}
                              </span>
                              {score != null && (
                                <span className="text-xs tabular-nums text-muted-foreground">{score}</span>
                              )}
                              {wrong && <X size={14} className="mt-auto self-end text-destructive" />}
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
                            disabled={locked}
                            value={tiebreaker}
                            onChange={(e) => setTiebreaker(e.target.value)}
                            placeholder="52"
                            className="min-h-11 w-24 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      )}
                    </article>
                  );
                }
                return (
                  <div
                    key={game.id}
                    className={`rounded-2xl bg-card p-3 ${
                      unpicked && !locked
                        ? "border border-dashed border-border-strong"
                        : "border border-border"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-faint">
                      <span>{game.slot}</span>
                      {isTb && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-soft-foreground">
                          Tiebreaker
                        </span>
                      )}
                      {winner && winner !== "tie" && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground tabular-nums">
                          Final {game.away_score}–{game.home_score}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2">
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
                            disabled={locked}
                            onClick={() => setPicks((p) => ({ ...p, [game.id]: side }))}
                            className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold ${
                              chosen
                                ? "border-accent bg-accent-soft text-foreground"
                                : "border-border bg-card text-foreground"
                            }`}
                          >
                            <TeamBadge name={game[side]} />
                            <span className="min-w-0 flex-1 truncate">
                              {game[side]}
                              <span className="ml-1 font-normal text-faint">
                                {side === "home" ? "(home)" : "(away)"}
                              </span>
                            </span>
                            {chosen && !winner && <Check size={18} className="shrink-0 text-accent" />}
                            {isWinner && <Check size={18} className="shrink-0 text-success" />}
                            {wrong && <X size={18} className="shrink-0 text-destructive" />}
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
                          disabled={locked}
                          value={tiebreaker}
                          onChange={(e) => setTiebreaker(e.target.value)}
                          placeholder="33"
                          className="min-h-11 w-24 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 rounded-2xl bg-background/95 py-2 backdrop-blur md:static md:bottom-auto md:bg-transparent md:py-0 md:backdrop-blur-none">
        <button
          onClick={() => save.mutate()}
          disabled={!canSubmit || locked || save.isPending || !isDirty}
          className={`min-h-13 w-full rounded-xl px-4 py-3.5 text-sm font-semibold shadow-lg transition-opacity md:w-auto ${
            isDirty && canSubmit && !locked
              ? "bg-accent text-accent-foreground hover:opacity-85 md:shadow-none"
              : "bg-secondary text-muted-foreground md:shadow-none"
          } ${save.isPending || !canSubmit || !isDirty || locked ? "opacity-60" : ""}`}
        >
          {save.isPending
            ? "Saving…"
            : !isDirty && canSubmit
              ? `Set ${activeEntry} saved`
              : `Save ${picked} of ${games.length} picks`}
        </button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground md:text-left" aria-live="polite">
          {saveHint}
        </p>
      </div>
    </div>
  );
}
