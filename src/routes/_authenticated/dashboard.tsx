import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Users } from "lucide-react";



import {
  fetchCurrentWeek,
  fetchMyLeagues,
  fetchPickEntries,
  fetchStandings,
  fetchWeek,
  gradeGame,
  leagueGames,
} from "@/lib/pool";
import { useLiveScores } from "@/hooks/useLiveScores";
import { InviteFriends } from "@/components/InviteFriends";
import { TeamBadge } from "@/components/pool/TeamBadge";
import { readInvite } from "@/lib/invite";
import { EmptyState, LoadingState } from "@/components/ui/feedback";

export const Route = createFileRoute("/_authenticated/dashboard")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Dashboard — Gridiron Gods" },
      {
        name: "description",
        content: "All your NFL pick'em leagues, the current week, and standings at a glance.",
      },
      { property: "og:title", content: "Dashboard — Gridiron Gods" },
      {
        property: "og:description",
        content: "All your NFL pick'em leagues, the current week, and standings at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function countdown(to: number, now: number) {
  const ms = to - now;
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function DashboardPage() {
  useLiveScores();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Someone who paid after opening an invite link continues straight into that league.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("membership") !== "success") return;
    const invite = readInvite();
    if (!invite) return;
    navigate({
      to: "/join/$code",
      params: { code: invite.code },
      search: invite.ref ? { ref: invite.ref } : {},
      replace: true,
    });
  }, [navigate]);

  const leagues = useQuery({ queryKey: ["leagues"], queryFn: fetchMyLeagues });

  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });
  const week = currentWeek.data ?? 1;

  const weekData = useQuery({
    queryKey: ["week", week],
    queryFn: () => fetchWeek(week),
    enabled: Boolean(currentWeek.data),
  });

  const standings = useQueries({
    queries: (leagues.data ?? []).map((l) => ({
      queryKey: ["standings", l.id, 0],
      queryFn: () => fetchStandings(l.id, 0),
    })),
  });

  const picks = useQueries({
    queries: (leagues.data ?? []).map((l) => ({
      queryKey: ["picks", l.id, week],
      queryFn: () => fetchPickEntries(l.id, week),
    })),
  });

  const allGames = weekData.data?.games ?? [];
  const nextKick = allGames
    .map((g) => (g.kickoff ? new Date(g.kickoff).getTime() : 0))
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0];
  const left = nextKick ? countdown(nextKick, now) : null;
  const nextLabel = nextKick
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(nextKick))
    : null;

  const upNext = allGames
    .filter((g) => !g.kickoff || new Date(g.kickoff).getTime() > now)
    .slice(0, 4);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
          Week {week}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold">
          {left ? `${left} until kickoff` : "Games are underway"}
        </h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {nextLabel ? `Next game ${nextLabel}.` : "Scores update on their own as games finish."}
        </p>
        {leagues.data?.[0] && (
          <Link
            to="/leagues/$leagueId"
            params={{ leagueId: leagues.data[0].id }}
            className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
          >
            Open picks
          </Link>
        )}
      </section>


      {leagues.isLoading && <LoadingState label="Loading your leagues" />}

      {leagues.data?.length === 0 && (
        <EmptyState
          title="Your first league starts here"
          description="Create a league for friends or join one with an invite code."
          action={
            <Link
              to="/leagues"
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
            >
              <Plus size={16} /> Start or join a league
            </Link>
          }
        />
      )}

      {(leagues.data?.length ?? 0) > 0 && (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Your leagues</h2>
            <Link to="/leagues" className="text-sm font-medium text-primary">
              Manage
            </Link>
          </div>

          {(leagues.data ?? []).map((league, i) => {
            const rows = standings[i]?.data ?? [];
            const me = rows.find((r) => r.userId === user.id);
            const leader = rows[0];
            const myPicks = (picks[i]?.data ?? []).filter(
              (e) => e.user_id === user.id && e.entry_no === 1,
            )[0];
            const games = leagueGames(allGames, league, week);
            const made = myPicks ? Object.keys(myPicks.picks ?? {}).length : 0;
            const pct = games.length ? Math.round((made / games.length) * 100) : 0;
            return (
              <article key={league.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-semibold">{league.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-faint">
                      <Users size={12} /> {rows.length || 0} sets ranked
                      {leader ? ` · led by ${leader.username}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums">
                    {me ? `#${me.rank}` : "—"}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Your Week {week} picks</span>
                    <span className="tabular-nums">
                      {made} of {games.length}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to="/leagues/$leagueId"
                    params={{ leagueId: league.id }}
                    className="flex min-h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
                  >
                    Open picks
                  </Link>
                  <Link
                    to="/leagues/$leagueId"
                    params={{ leagueId: league.id }}
                    className="flex min-h-11 items-center justify-center rounded-xl border border-border-strong text-sm font-medium"
                  >
                    Standings
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {upNext.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Up next</h2>
          <ul className="mt-3 grid gap-2.5">
            {upNext.map((g) => {
              const winner = gradeGame(g);
              return (
                <li key={g.id} className="flex items-center gap-3">
                  <div className="flex shrink-0 items-center -space-x-1.5">
                    <TeamBadge name={g.away} size={28} />
                    <TeamBadge name={g.home} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {g.away} at {g.home}
                    </p>
                    <p className="text-xs text-faint">{g.slot}</p>
                  </div>
                  {winner && winner !== "tie" && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {g.away_score}–{g.home_score}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {leagues.data?.[0] ? (
        <InviteFriends leagueCode={leagues.data[0].code} leagueName={leagues.data[0].name} compact />
      ) : null}

      <Link
        to="/profile"
        className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card px-4 text-sm font-medium"
      >
        Account, SZN Pass and commissioner tools
        <ChevronRight size={16} className="text-faint" />
      </Link>
    </div>
  );
}
