import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { LoadingState } from "@/components/ui/feedback";

import { gradeGame, isEarlyWeekGame, skipsEarlyGames, type Game, type League } from "@/lib/pool";
import { fetchLeagueWeek, isCollegeLeague } from "@/lib/league-sport";
import { refreshNfl } from "@/lib/nfl.functions";
import { refreshCfb } from "@/lib/cfb.functions";

function statusLabel(game: Game) {
  if (game.state === "post") return "Final";
  if (game.state === "in") return "Live";
  return game.slot || "Scheduled";
}

export function SchedulePanel({ week, league }: { week: number; league?: League }) {
  const college = league ? isCollegeLeague(league) : false;
  const sport = league?.sport ?? "nfl";
  const skipsEarly = league ? skipsEarlyGames(league, week) : false;
  const queryClient = useQueryClient();
  const refreshNflFn = useServerFn(refreshNfl);
  const refreshCfbFn = useServerFn(refreshCfb);
  const refresh = college ? refreshCfbFn : refreshNflFn;
  const [syncing, setSyncing] = useState(false);

  const weekQuery = useQuery({
    queryKey: ["week", sport, week],
    queryFn: () => fetchLeagueWeek(sport, week),
  });
  const games = weekQuery.data?.games ?? [];
  const weekData = weekQuery.data?.week ?? null;

  const runSync = async () => {
    setSyncing(true);
    try {
      await refresh({ data: {} });
      await queryClient.invalidateQueries();
      toast.success("Schedule and scores updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the NFL feed");
    } finally {
      setSyncing(false);
    }
  };

  if (weekQuery.isLoading) return <LoadingState label="Loading schedule" />;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 rounded-lg bg-accent-soft p-3.5 text-sm text-accent-soft-foreground">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>
          {college
            ? "Matchups and scores come straight from the college schedule — every game with an AP Top 25 team. Picks lock when a game kicks off, and standings recalculate as results go final."
            : "Matchups and scores come straight from the official NFL schedule for all 18 weeks. Picks lock automatically when the week's first game kicks off, and standings recalculate as results go final — nothing to type in."}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Week {week} {weekData?.locked ? "· picks locked" : "· picks open"}
        </h2>
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-40"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Updating…" : "Refresh now"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {games.map((g, i) => {
          const winner = gradeGame(g);
          const excluded = skipsEarly && isEarlyWeekGame(g);
          const hasScore = g.away_score != null && g.home_score != null;
          return (
            <div
              key={g.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div>
                <span className={winner === "away" ? "font-semibold" : "font-medium"}>{g.away}</span>
                <span className="text-faint"> @ </span>
                <span className={winner === "home" ? "font-semibold" : "font-medium"}>{g.home}</span>
                {excluded && (
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    doesn't count
                  </span>
                )}
                {g.id === weekData?.tiebreaker_game_id && (
                  <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-soft-foreground">
                    tiebreaker
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasScore && (
                  <span className="tabular-nums font-medium">
                    {g.away_score}–{g.home_score}
                  </span>
                )}
                <span className="text-xs text-faint">{statusLabel(g)}</span>
              </div>
            </div>
          );
        })}
        {!games.length && (
          <div className="px-4 py-6 text-center text-sm text-faint">
            No matchups loaded yet — tap “Refresh now”.
          </div>
        )}
      </div>
    </div>
  );
}
