import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";

import { fetchLiveScores, type LiveScoreGame } from "@/lib/livescores.functions";

function kickoffLabel(game: LiveScoreGame) {
  if (!game.kickoff) return game.statusLabel;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(game.kickoff));
}

function Row({ game }: { game: LiveScoreGame }) {
  const live = game.status === "live";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {game.away.name} at {game.home.name}
        </p>
        <p className="text-xs text-faint">
          {live || game.status === "finished" ? game.statusLabel : kickoffLabel(game)}
          {game.broadcast ? ` · ${game.broadcast}` : ""}
        </p>
      </div>
      {game.awayScore != null && game.homeScore != null ? (
        <span
          className={`shrink-0 tabular-nums text-sm font-semibold ${live ? "text-primary" : "text-muted-foreground"}`}
        >
          {game.awayScore}–{game.homeScore}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-faint">—</span>
      )}
    </li>
  );
}

/** Live NFL scoreboard, refreshed on its own every 30 seconds. */
export function LiveScoreboard({
  league = "nfl",
  limit = 12,
  title = "Live scores",
}: {
  league?: "nfl" | "college-football";
  limit?: number;
  title?: string;
}) {
  const fetcher = useServerFn(fetchLiveScores);
  const scores = useQuery({
    queryKey: ["live-scores", league, limit],
    queryFn: () => fetcher({ data: { league, limit } }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const games = scores.data?.games ?? [];
  const liveCount = games.filter((g) => g.status === "live").length;

  if (scores.isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-faint">Loading the scoreboard…</p>
      </section>
    );
  }

  if (scores.isError || !games.length) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-faint">
          {scores.isError ? "Scores are unavailable right now." : "No games on the board yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Radio size={13} className={liveCount ? "animate-pulse text-primary" : "text-faint"} />
          {liveCount ? `${liveCount} live now` : "Updates every 30s"}
        </span>
      </div>
      <ul className="mt-1 divide-y divide-border">
        {games.map((g) => (
          <Row key={g.id} game={g} />
        ))}
      </ul>
    </section>
  );
}
