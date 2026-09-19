import { useEffect, useState } from "react";
import { Clock3, Lock } from "lucide-react";

type KickoffGame = { kickoff: string | null };

export function ncaaPickDeadline(games: KickoffGame[]): number | null {
  const kickoffs = games
    .map((game) => (game.kickoff ? new Date(game.kickoff).getTime() : Number.NaN))
    .filter((kickoff) => Number.isFinite(kickoff));
  return kickoffs.length ? Math.min(...kickoffs) : null;
}

export function ncaaWeekLocked(games: KickoffGame[], storedLocked = false, now = Date.now()) {
  const deadline = ncaaPickDeadline(games);
  return storedLocked || (deadline != null && deadline <= now);
}

function countdown(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function NcaaPickDeadline({
  games,
  storedLocked = false,
}: {
  games: KickoffGame[];
  storedLocked?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = ncaaPickDeadline(games);
  const locked = ncaaWeekLocked(games, storedLocked, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (deadline == null) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-3" role="status">
        <div className="flex items-start gap-3">
          <Clock3 size={18} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold">Pick deadline pending</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The deadline will appear when kickoff times are posted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const deadlineLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(deadline));

  return (
    <div
      className={`mb-4 rounded-xl border p-3 ${
        locked ? "border-border bg-secondary" : "border-accent bg-accent-soft"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {locked ? (
          <Lock size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <Clock3 size={18} className="mt-0.5 shrink-0 text-accent-soft-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold">{locked ? "Picks locked" : "Weekly pick deadline"}</p>
            {!locked && (
              <p className="text-sm font-bold tabular-nums text-accent-soft-foreground">
                {countdown(deadline, now)} left
              </p>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {locked
              ? `The deadline passed ${deadlineLabel}. Saved picks are visible but can’t be changed.`
              : `All picks and the tiebreaker lock ${deadlineLabel}, when the first game begins.`}
          </p>
        </div>
      </div>
    </div>
  );
}