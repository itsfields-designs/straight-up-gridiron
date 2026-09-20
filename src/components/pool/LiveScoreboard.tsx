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

/** A single compact ticker chip for one game. */
function Chip({ game }: { game: LiveScoreGame }) {
  const live = game.status === "live";
  const hasScore = game.awayScore != null && game.homeScore != null;
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs">
      {live && (
        <Radio size={11} className="animate-pulse text-primary" aria-hidden />
      )}
      <span className="font-medium">{game.away.short}</span>
      {hasScore ? (
        <span
          className={`tabular-nums font-semibold ${live ? "text-primary" : "text-muted-foreground"}`}
        >
          {game.awayScore}
        </span>
      ) : (
        <span className="text-faint tabular-nums">—</span>
      )}
      <span className="text-faint">@</span>
      <span className="font-medium">{game.home.short}</span>
      {hasScore ? (
        <span
          className={`tabular-nums font-semibold ${live ? "text-primary" : "text-muted-foreground"}`}
        >
          {game.homeScore}
        </span>
      ) : (
        <span className="text-faint tabular-nums">—</span>
      )}
      <span className="text-faint">
        {live
          ? game.statusLabel
          : game.status === "finished"
            ? "F"
            : kickoffLabel(game)}
      </span>
    </span>
  );
}

/** A single compact ticker chip for the live top-25 college board. */
function CollegeChip({ game }: { game: LiveScoreGame }) {
  const live = game.status === "live";
  const final = game.status === "finished";
  const hasScore = game.awayScore != null && game.homeScore != null;
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs">
      {live && (
        <Radio size={11} className="animate-pulse text-primary" aria-hidden />
      )}
      <span className="font-medium">{game.away.name}</span>
      {hasScore ? (
        <span
          className={`tabular-nums font-semibold ${live ? "text-primary" : "text-muted-foreground"}`}
        >
          {game.awayScore}
        </span>
      ) : (
        <span className="text-faint tabular-nums">—</span>
      )}
      <span className="text-faint">@</span>
      <span className="font-medium">{game.home.name}</span>
      {hasScore ? (
        <span
          className={`tabular-nums font-semibold ${live ? "text-primary" : "text-muted-foreground"}`}
        >
          {game.homeScore}
        </span>
      ) : (
        <span className="text-faint tabular-nums">—</span>
      )}
      <span className="text-faint">
        {live ? game.statusLabel : final ? "Final" : kickoffLabel(game)}
      </span>
    </span>
  );
}

/**
 * Sleek scrolling live-score ticker. Polls the Big Ball Sports feed on its
 * own every 30 seconds and scrolls the scores horizontally.
 */
export function LiveScoreboard({
  league = "nfl",
  limit = 16,
}: {
  league?: "nfl" | "college-football";
  limit?: number;
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
  const isCollege = league === "college-football";

  if (scores.isLoading) {
    return (
      <div className="flex items-center gap-2 overflow-hidden rounded-full border border-border bg-secondary/60 px-4 py-2 text-xs text-faint">
        <Radio size={13} className="animate-pulse" />
        <span>Loading live scores…</span>
      </div>
    );
  }

  if (scores.isError || !games.length) {
    return (
      <div className="flex items-center gap-2 overflow-hidden rounded-full border border-border bg-secondary/60 px-4 py-2 text-xs text-faint">
        <Radio size={13} />
        <span>
          {scores.isError ? "Scores unavailable right now." : "No games on the board yet."}
        </span>
      </div>
    );
  }

  // Duplicate the list so the marquee loops seamlessly.
  const loop = [...games, ...games];
  const ChipComp = isCollege ? CollegeChip : Chip;

  return (
    <div className="group relative overflow-hidden rounded-full border border-border bg-card">
      {/* Left label — pinned, fades into the ticker */}
      <div className="absolute left-0 top-0 z-10 flex h-full items-center gap-1.5 rounded-l-full bg-card pl-3 pr-2">
        <Radio
          size={13}
          className={liveCount ? "animate-pulse text-primary" : "text-faint"}
        />
        <span className="text-xs font-semibold tabular-nums">
          {liveCount > 0 ? `${liveCount} live` : "Live"}
        </span>
      </div>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-9 z-10 w-6 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent" />

      {/* Scrolling track */}
      <div className="no-scrollbar overflow-hidden py-1.5 pl-14 pr-4">
        <div className="ticker-track">
          {loop.map((g, i) => (
            <ChipComp key={`${g.id}-${i}`} game={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
